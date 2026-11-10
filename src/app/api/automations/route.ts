import { withApi, ok, parseQuery, requireApiSession, ApiError } from '@/lib/http';
import { countByValue } from '@/lib/data/app';
import { EXECUTION_STATUSES, paginationSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return withApi({ route: '/api/automations', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { page, pageSize } = parseQuery(request, paginationSchema);
    const db = createServiceClient();
    const from = (page - 1) * pageSize;
    const [workflows, executionCounts] = await Promise.all([
      db.from('automation_workflows').select('*, steps:automation_steps(id, step_order, step_type, config)', { count: 'exact' }).eq('organization_id', session.organizationId).order('created_at', { ascending: false }).range(from, from + pageSize - 1),
      // Only the per status totals are needed, so count them with head requests
      // instead of pulling thousands of execution rows into memory.
      countByValue(db, 'automation_executions', 'status', EXECUTION_STATUSES, { organizationId: session.organizationId }),
    ]);
    if (workflows.error) throw new ApiError(500, 'Could not load automations.');
    return ok({
      workflows: (workflows.data ?? []).map((row) => {
        const typed = row as Record<string, unknown>;
        const steps = Array.isArray(typed.steps) ? typed.steps : [];
        return {
          id: String(typed.id),
          name: String(typed.name ?? ''),
          description: String(typed.description ?? ''),
          status: String(typed.status ?? 'draft'),
          triggerType: String(typed.trigger_type ?? 'manual'),
          steps: steps.map((s) => {
            const st = s as Record<string, unknown>;
            return { id: String(st.id), order: Number(st.step_order ?? 0), type: String(st.step_type ?? '') };
          }),
          createdAt: String(typed.created_at ?? ''),
        };
      }),
      executionCounts,
      page,
      pageSize,
      total: workflows.count ?? 0,
    });
  });
}
