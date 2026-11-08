import { withApi, ok, parseBody, requireApiSession, enforceRateLimit, ApiError } from '@/lib/http';
import { supportAskSchema } from '@/lib/validation';
import { answerSupportQuestion } from '@/lib/ai/support';
import { createServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    await enforceRateLimit(request, 'ai-support', 30, 3600, session.userId);
    const input = await parseBody(request, supportAskSchema);
    const result = await answerSupportQuestion({
      organizationId: session.organizationId,
      userId: session.userId,
      question: input.question,
    });

    if (input.ticket_id) {
      const db = createServiceClient();
      const { data: ticket } = await db.from('support_tickets').select('id').eq('id', input.ticket_id).eq('organization_id', session.organizationId).maybeSingle();
      if (!ticket) throw new ApiError(404, 'Ticket not found.');
      await db.from('support_messages').insert({
        organization_id: session.organizationId,
        ticket_id: ticket.id,
        author_type: 'ai',
        body: result.answer,
      });
    }

    return ok(result);
  });
}
