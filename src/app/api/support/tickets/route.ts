import { withApi, ok, parseBody, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { supportTicketSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApi(async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const [tickets, categories] = await Promise.all([
      db.from('support_tickets').select('*, messages:support_messages(id, body, author_type, created_at)').eq('organization_id', session.organizationId).order('created_at', { ascending: false }).limit(100),
      db.from('support_categories').select('key, name'),
    ]);
    if (tickets.error) throw new ApiError(500, 'Could not load support tickets.');
    return ok({ tickets: tickets.data ?? [], categories: categories.data ?? [] });
  });
}

export async function POST(request: Request) {
  return withApi(async () => {
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
