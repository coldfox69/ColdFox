import { withApi, ok, requirePlatformAdmin } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApi({ route: '/api/admin/console/me', method: 'GET' }, async () => {
    const { session, role } = await requirePlatformAdmin();
    const db = createServiceClient();
    const { data: roleRow } = await db.from('admin_roles').select('key, name, permissions').eq('key', role).maybeSingle();
    const permissions = (roleRow?.permissions as string[] | undefined) ?? [];
    return ok({
      userId: session.userId,
      email: session.email,
      role,
      roleName: roleRow?.name ?? role,
      permissions: permissions.includes('*') ? ['*'] : permissions,
    });
  });
}
