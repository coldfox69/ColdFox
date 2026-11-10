import { withApi, ok, requireApiSession } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST() {
  return withApi({ route: '/api/notifications/read', method: 'POST' }, async () => {
    const session = await requireApiSession();
    await createServiceClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', session.userId)
      .is('read_at', null);
    return ok({ read: true });
  });
}
