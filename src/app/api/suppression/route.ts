import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError, writeAudit } from '@/lib/http';
import { suppressionInputSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApi({ route: '/api/suppression', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const [entries, reasons] = await Promise.all([
      db.from('suppression_entries').select('*, reason:suppression_reasons(label)').eq('organization_id', session.organizationId).order('created_at', { ascending: false }).limit(1000),
      db.from('suppression_reasons').select('key, label, description'),
    ]);
    if (entries.error) throw new ApiError(500, 'Could not load the suppression list.');
    return ok({ entries: entries.data ?? [], reasons: reasons.data ?? [] });
  });
}

export async function POST(request: Request) {
  return withApi({ route: '/api/suppression', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const input = await parseBody(request, suppressionInputSchema);
    const db = createServiceClient();
    const { data, error } = await db
      .from('suppression_entries')
      .upsert(
        {
          organization_id: session.organizationId,
          email: input.email,
          email_normalized: input.email.toLowerCase().trim(),
          reason_key: input.reason_key,
          source: 'manual',
          notes: input.notes ?? null,
          created_by: session.userId,
        },
        { onConflict: 'organization_id,email_normalized' },
      )
      .select('*')
      .single();
    if (error || !data) throw new ApiError(500, 'Could not add that address to the suppression list.');
    await db.from('leads').update({ status: 'unsubscribed' }).eq('organization_id', session.organizationId).eq('email_normalized', input.email.toLowerCase().trim());
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'suppression.added', entityType: 'email', entityId: data.id as string, request, metadata: { reason: input.reason_key } });
    return ok(data, { status: 201 });
  });
}

export async function DELETE(request: Request) {
  return withApi({ route: '/api/suppression', method: 'DELETE' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) throw new ApiError(422, 'Missing suppression entry id.');
    const { data, error } = await createServiceClient().from('suppression_entries').delete().eq('id', id).eq('organization_id', session.organizationId).select('id').maybeSingle();
    if (error || !data) throw new ApiError(404, 'Suppression entry not found.', 'not_found');
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'suppression.removed', entityType: 'suppression', entityId: id, request });
    return ok({ removed: true });
  });
}
