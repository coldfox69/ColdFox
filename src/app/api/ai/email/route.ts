import { withApi, ok, parseBody, requireApiSession, assertRole, enforceRateLimit } from '@/lib/http';
import { aiEmailRequestSchema } from '@/lib/validation';
import { generateAiEmail } from '@/lib/ai/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return withApi(async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'ai-email', 30, 3600, session.userId);
    const input = await parseBody(request, aiEmailRequestSchema);
    const result = await generateAiEmail({
      organizationId: session.organizationId,
      userId: session.userId,
      ...input,
    });
    return ok(result);
  });
}
