import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { domainInputSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { assertDomain, checkDomainAuthentication } from '@/lib/email/deliverability';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Upper bound for the sending domain list. */
const DOMAIN_LIMIT = 200;

export async function GET() {
  return withApi(async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const { data: domains, error } = await db.from('sending_domains').select('*').eq('organization_id', session.organizationId).order('created_at', { ascending: false }).limit(DOMAIN_LIMIT);
    if (error) throw new ApiError(500, 'Could not load sending domains.');
    const checks = domains?.length
      ? await db.from('domain_authentication_checks').select('*').eq('organization_id', session.organizationId).in('domain_id', domains.map((d) => d.id)).order('checked_at', { ascending: false }).limit(500)
      : { data: [] as Record<string, unknown>[] };
    const events = await db.from('deliverability_events').select('*').eq('organization_id', session.organizationId).order('created_at', { ascending: false }).limit(20);
    return ok({ domains: domains ?? [], checks: checks.data ?? [], events: events.data ?? [] });
  });
}

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const input = await parseBody(request, domainInputSchema);
    await assertDomain(input.domain);
    const checks = await checkDomainAuthentication(input.domain, input.dkim_selector);
    const db = createServiceClient();

    const overall = checks.some((c) => c.type === 'mx' && c.status !== 'verified')
      ? 'invalid'
      : checks.every((c) => c.type !== 'spf' && c.type !== 'dkim' && c.type !== 'dmarc')
        ? 'not_configured'
        : checks.filter((c) => ['spf', 'dkim', 'dmarc'].includes(c.type)).every((c) => c.status === 'verified')
          ? 'verified'
          : checks.some((c) => c.status === 'invalid')
            ? 'invalid'
            : checks.some((c) => c.status === 'unable_to_verify')
              ? 'unable_to_verify'
              : 'needs_attention';

    const byType = (type: string) => checks.find((c) => c.type === type)?.status ?? 'not_configured';
    const { data: domain, error } = await db
      .from('sending_domains')
      .upsert(
        {
          organization_id: session.organizationId,
          domain: input.domain,
          dkim_selector: input.dkim_selector ?? null,
          status: overall,
          spf_status: byType('spf'),
          dkim_status: byType('dkim'),
          dmarc_status: byType('dmarc'),
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,domain' },
      )
      .select('*')
      .single();
    if (error || !domain) throw new ApiError(500, 'Could not save the domain.');

    await db.from('domain_authentication_checks').insert(
      checks.map((check) => ({
        organization_id: session.organizationId,
        domain_id: domain.id,
        check_type: check.type,
        status: check.status,
        record_found: check.records.join('\n').slice(0, 4000) || null,
        expected: check.expected,
        details: { detail: check.detail },
      })),
    );

    if (overall !== 'verified') {
      await db.from('deliverability_events').insert({
        organization_id: session.organizationId,
        domain_id: domain.id,
        event_type: 'dns_check',
        severity: overall === 'invalid' ? 'critical' : 'warning',
        message: `Authentication check for ${input.domain} returned "${overall}".`,
        metadata: { checks: checks.map((c) => ({ type: c.type, status: c.status })) },
      });
    }

    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'deliverability.checked', entityType: 'domain', entityId: domain.id as string, request, metadata: { domain: input.domain, status: overall } });
    return ok({ domain, checks });
  });
}

export async function DELETE(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) throw new ApiError(422, 'Missing domain id.');
    const { data, error } = await createServiceClient().from('sending_domains').delete().eq('id', id).eq('organization_id', session.organizationId).select('id').maybeSingle();
    if (error || !data) throw new ApiError(404, 'Domain not found.', 'not_found');
    return ok({ removed: true });
  });
}
