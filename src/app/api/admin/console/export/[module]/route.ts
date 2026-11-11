import { withApi, requirePlatformAdmin, ApiError, toCsv } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';
import { ADMIN_MODULES } from '@/lib/admin/shared';
import { listModule, readListParams } from '@/lib/admin/queries';

export const dynamic = 'force-dynamic';

const EXPORTABLE = new Set([
  'users', 'organizations', 'leads', 'campaigns', 'mailboxes', 'subscriptions',
  'plans', 'billing', 'tickets', 'announcements', 'ai-usage', 'api-usage',
  'feature-flags', 'settings', 'jobs', 'errors', 'audit', 'roles', 'webhooks',
  'email-activity', 'abuse',
]);

export async function GET(request: Request, { params }: { params: Promise<{ module: string }> }) {
  return withApi({ route: '/api/admin/console/export/[module]', method: 'GET' }, async () => {
    const { module } = await params;
    const access = ADMIN_MODULES[module];
    if (!access || !EXPORTABLE.has(module)) throw new ApiError(404, 'This module cannot be exported.');
    await requirePlatformAdmin(access.read);
    const url = new URL(request.url);
    url.searchParams.set('page', '1');
    url.searchParams.set('pageSize', '100');
    const result = await listModule(createServiceClient(), module, readListParams(url));
    const rows = (result.rows ?? []) as Array<Record<string, unknown>>;
    const columns = rows.length
      ? [...new Set(rows.flatMap((row) => Object.keys(row)))]
      : ['id'];
    const csv = toCsv([
      columns,
      ...rows.map((row) => columns.map((column) => {
        const value = row[column];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return value;
      })),
    ]);
    const filename = `coldfox-${module}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
