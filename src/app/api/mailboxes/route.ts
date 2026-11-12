import { withApi, ok, parseBody, parseQuery, requireApiSession, assertRole, ApiError, enforceRateLimit, writeAudit } from '@/lib/http';
import { smtpMailboxSchema, paginationSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { saveMailboxCredentials } from '@/lib/email/engine';
import { testMailboxConnection } from '@/lib/email/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi({ route: '/api/mailboxes', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { page, pageSize } = parseQuery(request, paginationSchema);
    const db = createServiceClient();
    const from = (page - 1) * pageSize;
    const { data, error, count } = await db
      .from('mailboxes')
      .select('id, email_address, display_name, provider, status, daily_limit, sent_today, warmup_enabled, reputation, last_sync_at, last_error, is_default, created_at', { count: 'exact' })
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new ApiError(500, 'Could not load mailboxes.');
    const configured = {
      gmail: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      outlook: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    };
    return ok({ mailboxes: data ?? [], providers: configured, page, pageSize, total: count ?? 0 });
  });
}

export async function POST(request: Request) {
  return withApi({ route: '/api/mailboxes', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    await enforceRateLimit(request, 'mailbox-create', 10, 3600, session.userId);
    const input = await parseBody(request, smtpMailboxSchema);
    const db = createServiceClient();

    const { data: existing } = await db.from('mailboxes').select('id').eq('organization_id', session.organizationId).eq('email_address', input.email_address).maybeSingle();
    if (existing) throw new ApiError(409, 'That mailbox is already connected.', 'duplicate_mailbox');

    const { data: allowed } = await db.rpc('check_org_limit', { p_org: session.organizationId, p_metric: 'mailboxes', p_increment: 1 });
    if (allowed === false) throw new ApiError(402, 'This workspace has reached its mailbox limit. Upgrade your plan to connect another mailbox.', 'plan_limit');

    const credentials = {
      kind: 'smtp' as const,
      host: input.host,
      port: input.port,
      secure: input.secure,
      username: input.username,
      password: input.password,
      imapHost: input.imap_host,
      imapPort: input.imap_port,
    };

    try {
      await testMailboxConnection(credentials);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed.';
      throw new ApiError(422, `Could not connect to that mailbox: ${message.slice(0, 300)}`, 'mailbox_connection_failed');
    }

    const { count } = await db.from('mailboxes').select('id', { count: 'exact', head: true }).eq('organization_id', session.organizationId);
    const { data: mailbox, error } = await db
      .from('mailboxes')
      .insert({
        organization_id: session.organizationId,
        user_id: session.userId,
        email_address: input.email_address,
        display_name: input.display_name ?? null,
        provider: 'smtp',
        status: 'connected',
        daily_limit: input.daily_limit,
        is_default: (count ?? 0) === 0,
        provider_config: { host: input.host, port: input.port, secure: input.secure, imap_host: input.imap_host ?? null, imap_port: input.imap_port ?? null },
      })
      .select('*')
      .single();
    if (error || !mailbox) throw new ApiError(500, 'Could not save the mailbox.');

    try {
      await saveMailboxCredentials(mailbox.id as string, session.organizationId, credentials as unknown as Record<string, unknown>);
    } catch (error) {
      await db.from('mailboxes').delete().eq('id', mailbox.id);
      throw error;
    }
    await db.rpc('record_usage', { p_org: session.organizationId, p_metric: 'mailboxes', p_quantity: 1 }).then(() => undefined, () => undefined);
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'mailbox.connected', entityType: 'mailbox', entityId: mailbox.id as string, request, metadata: { provider: 'smtp', email: input.email_address } });

    return ok(
      { id: mailbox.id, email_address: mailbox.email_address, display_name: mailbox.display_name, provider: mailbox.provider, status: mailbox.status, daily_limit: mailbox.daily_limit, is_default: mailbox.is_default },
      { status: 201 },
    );
  });
}
