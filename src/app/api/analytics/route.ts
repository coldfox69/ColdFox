import { withApi, ok, requireApiSession, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export async function GET() {
  return withApi(async () => {
    const session = await requireApiSession();
    const db = createServiceClient();
    const org = session.organizationId;
    const since = new Date(Date.now() - 56 * 86_400_000).toISOString();

    const [leads, campaigns, mailboxes, events, recentCampaigns, domains] = await Promise.all([
      db.from('leads').select('status, created_at').eq('organization_id', org).is('deleted_at', null).limit(50000),
      db.from('campaigns').select('id, name, status, total_leads, emails_sent, replies, bounces, unsubscribes, created_at').eq('organization_id', org).limit(2000),
      db.from('mailboxes').select('id, email_address, status, reputation, sent_today, daily_limit').eq('organization_id', org).limit(200),
      db.from('email_events').select('event_type, occurred_at, campaign_id').eq('organization_id', org).gte('occurred_at', since).limit(20000),
      db.from('campaign_events').select('event_type, occurred_at, lead:leads(first_name, last_name, email), campaign:campaigns(name)').eq('organization_id', org).order('occurred_at', { ascending: false }).limit(20),
      db.from('sending_domains').select('domain, status').eq('organization_id', org).limit(50),
    ]);

    if (leads.error || campaigns.error || events.error) throw new ApiError(500, 'Could not load analytics.');

    const statusCounts: Record<string, number> = {};
    for (const lead of leads.data ?? []) statusCounts[String(lead.status)] = (statusCounts[String(lead.status)] ?? 0) + 1;

    const totals = {
      leads: leads.data?.length ?? 0,
      activeCampaigns: (campaigns.data ?? []).filter((c) => c.status === 'active').length,
      campaigns: campaigns.data?.length ?? 0,
      emailsSent: (campaigns.data ?? []).reduce((sum, c) => sum + Number(c.emails_sent ?? 0), 0),
      replies: (campaigns.data ?? []).reduce((sum, c) => sum + Number(c.replies ?? 0), 0),
      bounces: (campaigns.data ?? []).reduce((sum, c) => sum + Number(c.bounces ?? 0), 0),
      unsubscribes: (campaigns.data ?? []).reduce((sum, c) => sum + Number(c.unsubscribes ?? 0), 0),
    };

    const eventCounts: Record<string, number> = {};
    const daily = new Map<string, { date: string; sent: number; replied: number; bounced: number }>();
    for (let i = 55; i >= 0; i -= 1) {
      const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      daily.set(key, { date: key, sent: 0, replied: 0, bounced: 0 });
    }
    for (const event of events.data ?? []) {
      const type = String(event.event_type);
      eventCounts[type] = (eventCounts[type] ?? 0) + 1;
      const key = dayKey(String(event.occurred_at));
      const row = daily.get(key);
      if (!row) continue;
      if (type === 'accepted') row.sent += 1;
      else if (type === 'replied') row.replied += 1;
      else if (type === 'bounced') row.bounced += 1;
    }

    const chartData = [...daily.values()];
    const weekly = [] as { date: string; sent: number; replied: number; bounced: number }[];
    for (let i = 0; i < chartData.length; i += 7) {
      const slice = chartData.slice(i, i + 7);
      weekly.push({
        date: slice[0]?.date?.slice(5) ?? '',
        sent: slice.reduce((s, d) => s + d.sent, 0),
        replied: slice.reduce((s, d) => s + d.replied, 0),
        bounced: slice.reduce((s, d) => s + d.bounced, 0),
      });
    }

    const sent = totals.emailsSent;
    return ok({
      totals: {
        ...totals,
        delivered: eventCounts.delivered ?? 0,
        opened: eventCounts.opened ?? 0,
        clicked: eventCounts.clicked ?? 0,
        bounceRate: sent ? Number(((totals.bounces / sent) * 100).toFixed(1)) : 0,
        replyRate: sent ? Number(((totals.replies / sent) * 100).toFixed(1)) : 0,
        unsubscribeRate: sent ? Number(((totals.unsubscribes / sent) * 100).toFixed(2)) : 0,
        sendingHealth: mailboxes.data?.length
          ? Math.round(
              (mailboxes.data.reduce((score, m) => {
                const rep = String(m.reputation);
                return score + (rep === 'excellent' ? 100 : rep === 'good' ? 85 : rep === 'fair' ? 65 : rep === 'poor' ? 35 : 50);
              }, 0) /
                mailboxes.data.length),
            )
          : 0,
      },
      statusCounts,
      chartData: weekly,
      campaigns: (campaigns.data ?? []).slice(0, 20).map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        totalLeads: c.total_leads,
        emailsSent: c.emails_sent,
        replies: c.replies,
        replyRate: Number(c.emails_sent) ? Number(((Number(c.replies) / Number(c.emails_sent)) * 100).toFixed(1)) : 0,
        bounces: c.bounces,
      })),
      mailboxes: mailboxes.data ?? [],
      domains: domains.data ?? [],
      recentActivity: (recentCampaigns.data ?? []).map((event) => ({
        type: event.event_type,
        at: event.occurred_at,
        lead: event.lead,
        campaign: event.campaign,
      })),
      eventCounts,
    });
  });
}
