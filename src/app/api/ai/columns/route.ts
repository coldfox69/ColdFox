import { withApi, ok, parseBody, requireApiSession, assertRole, enforceRateLimit } from '@/lib/http';
import { columnAnalysisSchema } from '@/lib/validation';
import { analyzeColumns } from '@/lib/ai/columns';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  return withApi({ route: '/api/ai/columns', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'ai-columns', 20, 3600, session.userId);
    const input = await parseBody(request, columnAnalysisSchema);
    const result = await analyzeColumns({
      organizationId: session.organizationId,
      userId: session.userId,
      headers: input.headers,
      sampleRows: input.sampleRows,
      totalRows: input.sampleRows.length,
    });
    return ok(result);
  });
}
