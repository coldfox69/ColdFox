import { withApi, ok, requireApiSession, assertRole, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { loadMailboxCredentials } from '@/lib/email/engine';
import { testMailboxConnection } from '@/lib/email/providers';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/mailboxes/[id]/test', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const { id } = await params;
    const db = createServiceClient();
    const { data: mailbox } = await db.from('mailboxes').select('id').eq('id', id).eq('organization_id', session.organizationId).maybeSingle();
    if (!mailbox) throw new ApiError(404, 'Mailbox not found.', 'not_found');

    try {
      const { credentials } = await loadMailboxCredentials(id);
      const result = await testMailboxConnection(credentials);
      await db.from('mailboxes').update({ status: 'connected', last_error: null }).eq('id', id);
      return ok({ ok: true, detail: result.detail });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed.';
      await db.from('mailboxes').update({ status: 'error', last_error: message.slice(0, 500) }).eq('id', id);
      throw new ApiError(422, message.slice(0, 400), 'mailbox_test_failed');
    }
  });
}
