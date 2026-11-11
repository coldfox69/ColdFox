import { withApi, ok, requirePlatformAdmin, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { ADMIN_MODULES } from '@/lib/admin/shared';
import { getModuleDetail, listModule, readListParams } from '@/lib/admin/queries';
import { getPlatformAnalytics, getPlatformOverview, getRevenue, getSystemHealth } from '@/lib/admin/dashboard';
import { mutateModule } from '@/lib/admin/mutations';

export const dynamic = 'force-dynamic';

function accessFor(module: string) {
  const access = ADMIN_MODULES[module];
  if (!access) throw new ApiError(404, 'Unknown admin module.');
  return access;
}

export async function GET(request: Request, { params }: { params: Promise<{ module: string }> }) {
  return withApi({ route: '/api/admin/console/[module]', method: 'GET' }, async () => {
    const { module } = await params;
    const access = accessFor(module);
    await requirePlatformAdmin(access.read);
    const db = createServiceClient();
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (id) {
      return ok(await getModuleDetail(db, module, id));
    }

    if (module === 'overview') return ok(await getPlatformOverview(db));
    if (module === 'analytics') {
      const days = Math.min(365, Math.max(7, Number(url.searchParams.get('days') ?? 30)));
      return ok(await getPlatformAnalytics(db, days));
    }
    if (module === 'revenue') {
      const days = Math.min(365, Math.max(7, Number(url.searchParams.get('days') ?? 30)));
      return ok(await getRevenue(db, days));
    }
    if (module === 'system-health') {
      return ok(await getSystemHealth(db));
    }

    return ok(await listModule(db, module, readListParams(url)));
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  return withApi({ route: '/api/admin/console/[module]', method: 'POST' }, async () => {
    const { module } = await params;
    const access = accessFor(module);
    if (!access.manage) throw new ApiError(405, `${module} is read-only.`);
    const { session } = await requirePlatformAdmin(access.manage);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();
    const result = await mutateModule({
      db,
      module,
      body: { ...body, action: String(body.action ?? 'create') },
      session,
      request,
    });
    return ok(result.data, { status: result.status ?? 200 });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ module: string }> }) {
  return withApi({ route: '/api/admin/console/[module]', method: 'PATCH' }, async () => {
    const { module } = await params;
    const access = accessFor(module);
    if (!access.manage) throw new ApiError(405, `${module} is read-only.`);
    const { session } = await requirePlatformAdmin(access.manage);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();
    const result = await mutateModule({
      db,
      module,
      body: { ...body, action: String(body.action ?? 'update') },
      session,
      request,
    });
    return ok(result.data, { status: result.status ?? 200 });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ module: string }> }) {
  return withApi({ route: '/api/admin/console/[module]', method: 'DELETE' }, async () => {
    const { module } = await params;
    const access = accessFor(module);
    const required = access.remove ?? access.manage;
    if (!required) throw new ApiError(405, `${module} is read-only.`);
    const { session } = await requirePlatformAdmin(required);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();
    const result = await mutateModule({
      db,
      module,
      body: { ...body, action: 'delete' },
      session,
      request,
    });
    return ok(result.data, { status: result.status ?? 200 });
  });
}
