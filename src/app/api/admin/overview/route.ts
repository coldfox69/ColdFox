import { withApi, ok, requirePlatformAdmin, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return withApi(async () => {
    await requirePlatformAdmin('orgs.view');
    const db = createServiceClient();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

    const [orgs, users, campaigns, events, tickets, errors, audit, jobs] = await Promise.all([
      db.from('organizations').select('id, name, plan_key, is_suspended, created_at').order('created_at', { ascending: false }).limit(10),
      db.auth.admin.listUsers({ page: 1, perPage: 1 }),
      db.from('campaigns').select('status').limit(10000),
      db.from('email_events').select('event_type, occurred_at').gte('occurred_at', since).limit(20000),
      db.from('support_tickets').select('status').limit(5000),
      db.from('error_logs').select('id', { count: 'exact', head: true }).gte('created_at', since),
      db.from('audit_logs').select('action, actor_email, created_at').order('created_at', { ascending: false }).limit(15),
      db.from('background_jobs').select('status').limit(5000),
    ]);
    if (orgs.error || campaigns.error) throw new ApiError(500, 'Could not load platform metrics.');

    const group = (rows: { status: string }[] | null) => {
      const out: Record<string, number> = {};
      for (const row of rows ?? []) out[String(row.status)] = (out[String(row.status)] ?? 0) + 1;
      return out;
    };
    const eventCounts: Record<string, number> = {};
    for (const event of events.data ?? []) eventCounts[String(event.event_type)] = (eventCounts[String(event.event_type)] ?? 0) + 1;

    return ok({
      totals: {
        organizations: orgs.data?.length ?? 0,
        users: (users.data as { total?: number } | null)?.total ?? 0,
        campaigns: campaigns.data?.length ?? 0,
        emailsAccepted: eventCounts.accepted ?? 0,
        replies: eventCounts.replied ?? 0,
        ticketsOpen: (tickets.data ?? []).filter((t) => ['open', 'in_progress'].includes(String(t.status))).length,
        errorsLast30d: errors.count ?? 0,
      },
      campaignStatuses: group(campaigns.data as { status: string }[] | null),
      jobStatuses: group(jobs.data as { status: string }[] | null),
      ticketStatuses: group(tickets.data as { status: string }[] | null),
      recentOrganizations: orgs.data ?? [],
      recentAudit: audit.data ?? [],
    });
  });
}
