import { withApi, ok, requirePlatformAdmin, ApiError } from '@/lib/http';
import { countByValue } from '@/lib/data/app';
import { CAMPAIGN_STATUSES, JOB_STATUSES, TICKET_STATUSES } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApi({ route: '/api/admin/overview', method: 'GET' }, async () => {
    await requirePlatformAdmin('orgs.view');
    const db = createServiceClient();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [orgs, orgCount, users, campaignStatuses, campaignCount, accepted, replied, ticketStatuses, errors, audit, jobStatuses] = await Promise.all([
      db.from('organizations').select('id, name, plan_key, is_suspended, created_at').order('created_at', { ascending: false }).limit(10),
      // Exact totals with head requests: no rows are transferred to count them.
      db.from('organizations').select('id', { count: 'exact', head: true }),
      db.auth.admin.listUsers({ page: 1, perPage: 1 }),
      countByValue(db, 'campaigns', 'status', CAMPAIGN_STATUSES),
      db.from('campaigns').select('id', { count: 'exact', head: true }),
      db.from('email_events').select('id', { count: 'exact', head: true }).eq('event_type', 'accepted').gte('occurred_at', since),
      db.from('email_events').select('id', { count: 'exact', head: true }).eq('event_type', 'replied').gte('occurred_at', since),
      countByValue(db, 'support_tickets', 'status', TICKET_STATUSES),
      db.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
      db.from('audit_logs').select('action, actor_email, created_at').order('created_at', { ascending: false }).limit(15),
      countByValue(db, 'background_jobs', 'status', JOB_STATUSES),
    ]);
    if (orgs.error) throw new ApiError(500, 'Could not load platform metrics.');

    return ok({
      totals: {
        organizations: orgCount.count ?? 0,
        users: (users.data as { total?: number } | null)?.total ?? 0,
        campaigns: campaignCount.count ?? 0,
        emailsAccepted: accepted.count ?? 0,
        replies: replied.count ?? 0,
        ticketsOpen: (ticketStatuses.open ?? 0) + (ticketStatuses.in_progress ?? 0),
        errorsLast30d: errors.count ?? 0,
      },
      campaignStatuses,
      jobStatuses,
      ticketStatuses,
      recentOrganizations: orgs.data ?? [],
      recentAudit: audit.data ?? [],
    });
  });
}
