import { withApi, ok, requireApiSession } from '@/lib/http';
import { getWorkerHeartbeat } from '@/lib/email/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reports when the scheduled worker last ran. The worker itself is triggered
 * by an external scheduler, so this is how the UI tells the difference between
 * "scheduled campaigns are safe to leave alone" and "nothing will send".
 */
export async function GET() {
  return withApi({ route: '/api/cron/status', method: 'GET' }, async () => {
    await requireApiSession();
    return ok(await getWorkerHeartbeat());
  });
}
