import { withApi, ok, parseBody, requireApiSession, assertRole, ApiError } from '@/lib/http';
import { mailboxUpdateSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const { id } = await params;
    const input = await parseBody(request, mailboxUpdateSchema);
    const db = createServiceClient();
    const update: Record<string, unknown> = {};
    if (input.daily_limit !== undefined) update.daily_limit = input.daily_limit;
    if (input.warmup_enabled !== undefined) update.warmup_enabled = input.warmup_enabled;
    if (input.display_name !== undefined) update.display_name = input.display_name;
    if (input.is_default === true) {
      await db.from('mailboxes').update({ is_default: false }).eq('organization_id', session.organizationId);
      update.is_default = true;
    }
    if (!Object.keys(update).length) throw new ApiError(422, 'Nothing to update.');
    const { data, error } = await db.from('mailboxes').update(update).eq('id', id).eq('organization_id', session.organizationId).select('id, daily_limit, warmup_enabled, display_name, is_default').maybeSingle();
    if (error || !data) throw new ApiError(404, 'Mailbox not found.', 'not_found');
    return ok(data);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const { id } = await params;
    const db = createServiceClient();
    const { data: mailbox } = await db.from('mailboxes').select('id').eq('id', id).eq('organization_id', session.organizationId).maybeSingle();
    if (!mailbox) throw new ApiError(404, 'Mailbox not found.', 'not_found');

    const { count } = await db.from('campaigns').select('id', { count: 'exact', head: true }).eq('mailbox_id', id).in('status', ['active', 'scheduled', 'paused']);
    if (count) throw new ApiError(409, 'Pause or reassign active campaigns before disconnecting this mailbox.', 'mailbox_in_use');

    await db.from('mailbox_credentials').delete().eq('mailbox_id', id);
    await db.from('mailboxes').update({ status: 'disconnected', last_error: 'Disconnected by a workspace admin.' }).eq('id', id);
    return ok({ disconnected: true });
  });
}
