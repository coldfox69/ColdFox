import { withApi, ok, parseBody, requireApiSession, assertRole, enforceRateLimit } from '@/lib/http';
import { aiEmailRequestSchema } from '@/lib/validation';
import { generateAiEmail, generateAiEmailStream, type AiStreamEvent } from '@/lib/ai/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return withApi({ route: '/api/ai/email', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'ai-email', 30, 3600, session.userId);
    const input = await parseBody(request, aiEmailRequestSchema);
    const payload = {
      organizationId: session.organizationId,
      userId: session.userId,
      ...input,
    };

    if (!input.stream) {
      const result = await generateAiEmail(payload);
      return ok(result);
    }

    // Token-by-token streaming. The client renders each delta as it arrives.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: AiStreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        try {
          for await (const event of generateAiEmailStream(payload, request.signal)) {
            send(event);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'The AI request failed.';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`));
        } finally {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
      cancel() {
        // The client aborted; nothing else to do.
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  });
}
