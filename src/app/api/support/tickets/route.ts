import { withApi, ok, parseBody, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { supportTicketSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** Upper bound for the messages loaded with the ticket list. */
const MESSAGE_LIMIT = 500;

export async function GET() {
  return withApi({ route: '/api/support/tickets', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const [tickets, categories] = await Promise.all([
      db.from('support_tickets').select('*').eq('organization_id', session.organizationId).order('created_at', { ascending: false }).limit(100),
      db.from('support_categories').select('key, name'),
    ]);
    if (tickets.error) throw new ApiError(500, 'Could not load support tickets.');
    const ticketIds = (tickets.data ?? []).map((ticket) => String(ticket.id));
    // Bounded message list instead of an unbounded embedded resource.
    const { data: messageRows } = ticketIds.length
      ? await db
          .from('support_messages')
          .select('id, ticket_id, body, author_type, created_at')
          .eq('organization_id', session.organizationId)
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: true })
          .limit(MESSAGE_LIMIT)
      : { data: [] as Record<string, unknown>[] };
    const messagesByTicket = new Map<string, Record<string, unknown>[]>();
    for (const message of messageRows ?? []) {
      const key = String(message.ticket_id);
      const list = messagesByTicket.get(key) ?? [];
      list.push({ id: message.id, body: message.body, author_type: message.author_type, created_at: message.created_at });
      messagesByTicket.set(key, list);
    }
    return ok({
      tickets: (tickets.data ?? []).map((ticket) => ({ ...ticket, messages: messagesByTicket.get(String(ticket.id)) ?? [] })),
      categories: categories.data ?? [],
    });
  });
}

export async function POST(request: Request) {
  return withApi({ route: '/api/support/tickets', method: 'POST' }, async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'support-ticket', 10, 3600, session.userId);
    const input = await parseBody(request, supportTicketSchema);
    const db = createServiceClient();
    const { data, error } = await db
      .from('support_tickets')
      .insert({
        organization_id: session.organizationId,
        user_id: session.userId,
        category_key: input.category_key ?? null,
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        status: 'open',
      })
      .select('*')
      .single();
    if (error || !data) throw new ApiError(500, 'Could not open a support ticket.');
    await db.from('support_messages').insert({ organization_id: session.organizationId, ticket_id: data.id, author_id: session.userId, author_type: 'user', body: input.description, is_internal: false });
    return ok(data, { status: 201 });
  });
}
