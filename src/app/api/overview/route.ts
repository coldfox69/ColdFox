import { withApi, ok, requireApiSession, ApiError } from '@/lib/http';
import { countByValue } from '@/lib/data/app';
import { CAMPAIGN_STATUSES } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

/** Upper bound for the campaign rows used to aggregate the sending counters. */
const CAMPAIGN_LIMIT = 1000;

/** Upper bound for the email event rows used to build the chart. */
const EVENT_LIMIT = 5000;

export async function GET() {
  return withApi(async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const since = new Date(Date.now() - 56 * 86_400_000).toISOString();
    const [leads, campaigns, campaignStatuses, mailboxes, events] = await Promise.all([
      // Exact head count: the total is all we need, no lead rows are transferred.
      db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', session.organizationId).is('deleted_at', null),
      db.from('campaigns').select('id, name, description, status, total_leads, emails_sent, replies, bounces, unsubscribes, created_at, launch_at, mailbox_id, template_id, mailbox:mailboxes(email_address)').eq('organization_id', session.organizationId).order('created_at', { ascending: false }).limit(CAMPAIGN_LIMIT),
      // Exact per status counts, no campaign rows are transferred.
      countByValue(db, 'campaigns', 'status', CAMPAIGN_STATUSES, (query) => query.eq('organization_id', session.organizationId)),
      db.from('mailboxes').select('id, email_address, display_name, provider, status, daily_limit, sent_today, warmup_enabled, reputation, last_error, created_at').eq('organization_id', session.organizationId).limit(200),
      // Bounded sample of the 56 day window, newest first.
      db.from('email_events').select('event_type, occurred_at').eq('organization_id', session.organizationId).gte('occurred_at', since).order('occurred_at', { ascending: false }).limit(EVENT_LIMIT),
    ]);
    if (leads.error || campaigns.error || mailboxes.error || events.error) throw new ApiError(500, 'Could not load overview.');

    const campaignRows = (campaigns.data ?? []) as Record<string, unknown>[];
    const eventCounts: Record<string, number> = {};
    for (const event of events.data ?? []) {
      const type = String((event as Record<string, unknown>).event_type);
      eventCounts[type] = (eventCounts[type] ?? 0) + 1;
    }

    return ok({
      totals: {
        totalLeads: leads.count ?? 0,
        activeCampaigns: campaignStatuses.active ?? 0,
        emailsSent: campaignRows.reduce((sum, row) => sum + Number(row.emails_sent ?? 0), 0),
        delivered: eventCounts.delivered ?? 0,
        replied: campaignRows.reduce((sum, row) => sum + Number(row.replies ?? 0), 0),
        bounced: campaignRows.reduce((sum, row) => sum + Number(row.bounces ?? 0), 0),
        unsubscribed: campaignRows.reduce((sum, row) => sum + Number(row.unsubscribes ?? 0), 0),
        sendingHealth: mailboxes.data?.length
          ? Math.round(
              (mailboxes.data as Record<string, unknown>[]).reduce((score, row) => {
                const rep = String(row.reputation);
                return score + (rep === 'excellent' ? 100 : rep === 'good' ? 85 : rep === 'fair' ? 65 : rep === 'poor' ? 35 : 50);
              }, 0) / mailboxes.data.length,
            )
          : 0,
      },
      chartData: [],
      campaigns: campaignRows.slice(0, 8).map((row) => ({
        id: String(row.id),
        name: String(row.name ?? 'Untitled'),
        description: String(row.description ?? ''),
        status: String(row.status ?? 'draft'),
        leadsCount: Number(row.total_leads ?? 0),
        emailsSent: Number(row.emails_sent ?? 0),
        replies: Number(row.replies ?? 0),
        bounces: Number(row.bounces ?? 0),
        unsubscribes: Number(row.unsubscribes ?? 0),
        replyRate: 0,
        bounceRate: 0,
        createdAt: String(row.created_at ?? ''),
        scheduledAt: row.launch_at ? String(row.launch_at) : null,
        mailbox: (row.mailbox as { email_address?: string } | null)?.email_address ?? 'No mailbox',
        mailboxId: row.mailbox_id ? String(row.mailbox_id) : null,
        templateId: row.template_id ? String(row.template_id) : null,
      })),
      mailboxes: (mailboxes.data ?? []).map((row) => ({
        id: String(row.id),
        email: String(row.email_address),
        displayName: row.display_name ? String(row.display_name) : null,
        provider: (String(row.provider) as any) || 'smtp',
        status: String(row.status ?? 'disconnected'),
        dailyLimit: Number(row.daily_limit ?? 0),
        sentToday: Number(row.sent_today ?? 0),
        lastSync: 'Never',
        warmupEnabled: Boolean(row.warmup_enabled),
        reputation: (String(row.reputation) as any) || 'unknown',
        lastError: row.last_error ? String(row.last_error) : null,
      })),
      activity: [],
      recommendations: [],
    });
  });
}
