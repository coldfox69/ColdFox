import { withApi, ok, parseBody, requireApiSession, ApiError } from '@/lib/http';
import { supportMessageSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

/** Upper bound for a ticket message list. */
const MESSAGE_LIMIT = 500;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/support/tickets/[id]', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const db = createServiceClient();
    const { data: ticket } = await db.from('support_tickets').select('*').eq('id', id).eq('organization_id', session.organizationId).maybeSingle();
    if (!ticket) throw new ApiError(404, 'Ticket not found.', 'not_found');
    const { data: messages } = await db.from('support_messages').select('*').eq('ticket_id', id).eq('organization_id', session.organizationId).eq('is_internal', false).order('created_at').limit(MESSAGE_LIMIT);
    return ok({ ticket, messages: messages ?? [] });
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/support/tickets/[id]', method: 'POST' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const { body } = await parseBody(request, supportMessageSchema);
    const db = createServiceClient();
    const { data: ticket } = await db.from('support_tickets').select('id, status').eq('id', id).eq('organization_id', session.organizationId).maybeSingle();
    if (!ticket) throw new ApiError(404, 'Ticket not found.', 'not_found');
    if (['closed', 'resolved'].includes(String(ticket.status))) throw new ApiError(409, 'This ticket is closed. Open a new ticket instead.', 'ticket_closed');
    const { data, error } = await db.from('support_messages').insert({ organization_id: session.organizationId, ticket_id: id, author_id: session.userId, author_type: 'user', body }).select('*').single();
    if (error || !data) throw new ApiError(500, 'Could not add your message.');
    await db.from('support_tickets').update({ status: 'open' }).eq('id', id);
    return ok(data, { status: 201 });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/support/tickets/[id]', method: 'PATCH' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    if (!body.status || !['open', 'in_progress', 'waiting', 'resolved', 'closed'].includes(body.status)) throw new ApiError(422, 'Invalid status.');
    const { data, error } = await createServiceClient()
      .from('support_tickets')
      .update({ status: body.status, resolved_at: ['resolved', 'closed'].includes(body.status) ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .select('id, status')
      .maybeSingle();
    if (error || !data) throw new ApiError(404, 'Ticket not found.', 'not_found');
    return ok(data);
  });
}
