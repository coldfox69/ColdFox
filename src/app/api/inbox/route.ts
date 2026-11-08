import { withApi, ok, requireApiSession, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const threadId = url.searchParams.get('threadId');
    const db = createServiceClient();

    if (threadId) {
      const { data: thread } = await db
        .from('email_threads')
        .select('*, lead:leads(id, first_name, last_name, email, company_name, status)')
        .eq('id', threadId)
        .eq('organization_id', session.organizationId)
        .maybeSingle();
      if (!thread) throw new ApiError(404, 'Conversation not found.', 'not_found');
      const { data: messages } = await db
        .from('email_messages')
        .select('*')
        .eq('thread_id', threadId)
        .eq('organization_id', session.organizationId)
        .order('created_at', { ascending: true });
      return ok({ thread, messages: messages ?? [] });
    }

    const archived = url.searchParams.get('archived') === '1';
    const { data: threads, error } = await db
      .from('email_threads')
      .select('*, lead:leads(id, first_name, last_name, email, company_name)')
      .eq('organization_id', session.organizationId)
      .eq('is_archived', archived)
      .order('last_message_at', { ascending: false })
      .limit(200);
    if (error) throw new ApiError(500, 'Could not load the inbox.');

    const ids = (threads ?? []).map((t) => t.id as string);
    const { data: messages } = ids.length
      ? await db
          .from('email_messages')
          .select('id, thread_id, direction, from_email, subject, body_text, snippet, received_at, sent_at, is_read, created_at')
          .eq('organization_id', session.organizationId)
          .in('thread_id', ids)
          .order('created_at', { ascending: false })
          .limit(2000)
      : { data: [] as Record<string, unknown>[] };

    const latest = new Map<string, Record<string, unknown>>();
    for (const message of messages ?? []) {
      const key = String(message.thread_id);
      if (!latest.has(key)) latest.set(key, message);
    }

    return ok({
      threads: (threads ?? []).map((thread) => ({
        ...thread,
        latest_message: latest.get(String(thread.id)) ?? null,
      })),
    });
  });
}
