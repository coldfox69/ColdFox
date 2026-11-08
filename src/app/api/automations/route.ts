import { withApi, ok, requireApiSession, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApi(async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const [workflows, executions] = await Promise.all([
      db.from('automation_workflows').select('*, steps:automation_steps(id, step_order, step_type, config)').eq('organization_id', session.organizationId).order('created_at', { ascending: false }).limit(100),
      db.from('automation_executions').select('status').eq('organization_id', session.organizationId).limit(5000),
    ]);
    if (workflows.error) throw new ApiError(500, 'Could not load automations.');
    const executionCounts: Record<string, number> = {};
    for (const row of executions.data ?? []) {
      const key = String((row as Record<string, unknown>).status);
      executionCounts[key] = (executionCounts[key] ?? 0) + 1;
    }
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
    });
  });
}
