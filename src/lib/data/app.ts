import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { tagsForLeads } from '@/lib/leads';
import {
  formatDate,
  formatDateTime,
  formatRelative,
  pct,
  toCampaignStatus,
  toLeadStatus,
  toMailboxStatus,
  toReputation,
  type AnalyticsVM,
  type CampaignVM,
  type ConversationThreadVM,
  type LeadDetailVM,
  type LeadNoteVM,
  type LeadVM,
  type MailboxVM,
  type MessageVM,
  type OverviewVM,
  type TemplateVM,
} from '@/lib/view-models';

type Row = Record<string, unknown>;

const str = (value: unknown, fallback = ''): string => (value === null || value === undefined ? fallback : String(value));
const num = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0);
const arr = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

function mapLead(row: Row, tags: string[] = []): LeadVM {
  return {
    id: str(row.id),
    firstName: str(row.first_name),
    lastName: str(row.last_name),
    email: str(row.email),
    company: str(row.company_name),
    jobTitle: str(row.job_title),
    status: toLeadStatus(row.status),
    tags,
    source: str(row.source, 'manual'),
    lastContacted: row.last_contacted_at ? formatDate(row.last_contacted_at) : null,
    nextFollowUp: row.next_follow_up_at ? formatDate(row.next_follow_up_at) : null,
    industry: row.industry ? str(row.industry) : null,
    website: row.website ? str(row.website) : null,
    phone: row.phone ? str(row.phone) : null,
    linkedIn: row.linkedin_url ? str(row.linkedin_url) : null,
    createdAt: formatDate(row.created_at),
  };
}

function mapCampaign(row: Row): CampaignVM {
  const mailbox = row.mailbox as { email_address?: string } | null;
  const sent = num(row.emails_sent);
  const replies = num(row.replies);
  const bounces = num(row.bounces);
  return {
    id: str(row.id),
    name: str(row.name),
    description: str(row.description),
    status: toCampaignStatus(row.status),
    leadsCount: num(row.total_leads),
    emailsSent: sent,
    replies,
    bounces,
    unsubscribes: num(row.unsubscribes),
    replyRate: pct(replies, sent),
    bounceRate: pct(bounces, sent),
    createdAt: formatDate(row.created_at),
    scheduledAt: row.launch_at ? formatDateTime(row.launch_at) : null,
    mailbox: mailbox?.email_address ? String(mailbox.email_address) : 'No mailbox',
    mailboxId: row.mailbox_id ? str(row.mailbox_id) : null,
    templateId: row.template_id ? str(row.template_id) : null,
  };
}

function mapMailbox(row: Row): MailboxVM {
  return {
    id: str(row.id),
    email: str(row.email_address),
    displayName: row.display_name ? str(row.display_name) : null,
    provider: (str(row.provider) as MailboxVM['provider']) || 'smtp',
    status: toMailboxStatus(row.status),
    dailyLimit: num(row.daily_limit),
    sentToday: num(row.sent_today),
    lastSync: formatRelative(row.last_sync_at),
    warmupEnabled: Boolean(row.warmup_enabled),
    reputation: toReputation(row.reputation),
    lastError: row.last_error ? str(row.last_error) : null,
  };
}

function mapTemplate(row: Row): TemplateVM {
  return {
    id: str(row.id),
    name: str(row.name),
    subject: str(row.subject),
    body: str(row.body_text),
    category: str(row.category, 'General'),
    tags: arr(row.tags),
    createdAt: formatDate(row.created_at),
    updatedAt: formatDate(row.updated_at),
    isShared: Boolean(row.is_shared),
    usageCount: num(row.usage_count),
  };
}

function mapMessage(row: Row): MessageVM {
  return {
    id: str(row.id),
    from: str(row.from_email),
    to: arr(row.to_emails).join(', '),
    subject: str(row.subject),
    body: str(row.body_text || row.body_html || row.snippet),
    sentAt: formatDateTime(row.sent_at || row.received_at || row.created_at),
    isOutbound: str(row.direction) === 'outbound',
  };
}

export async function getCampaigns(orgId: string): Promise<CampaignVM[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('campaigns')
    .select('*, mailbox:mailboxes(email_address)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return [];
  return (data ?? []).map(mapCampaign);
}

export async function getLeads(orgId: string, limit = 1000): Promise<LeadVM[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('leads')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  const tags = await tagsForLeads(db, orgId, (data ?? []).map((row) => row.id as string));
  return (data ?? []).map((row) => mapLead(row, tags.get(row.id as string) ?? []));
}

export async function getLeadDetail(orgId: string, leadId: string): Promise<LeadDetailVM | null> {
  const db = createServiceClient();
  const { data: lead } = await db.from('leads').select('*').eq('id', leadId).eq('organization_id', orgId).is('deleted_at', null).maybeSingle();
  if (!lead) return null;

  const [tags, notes, activities, threads] = await Promise.all([
    tagsForLeads(db, orgId, [leadId]),
    db.from('lead_notes').select('id, body, created_at').eq('organization_id', orgId).eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
    db.from('lead_activities').select('id, activity_type, description, occurred_at').eq('organization_id', orgId).eq('lead_id', leadId).order('occurred_at', { ascending: false }).limit(50),
    db.from('email_threads').select('*, lead:leads(id, first_name, last_name, email, company_name)').eq('organization_id', orgId).eq('lead_id', leadId).order('last_message_at', { ascending: false }).limit(20),
  ]);

  const threadRows = (threads.data ?? []) as Row[];
  const threadIds = threadRows.map((row) => str(row.id));
  const { data: messages } = threadIds.length
    ? await db.from('email_messages').select('*').eq('organization_id', orgId).in('thread_id', threadIds).order('created_at', { ascending: true }).limit(500)
    : { data: [] as Row[] };
  const grouped = new Map<string, MessageVM[]>();
  for (const message of messages ?? []) {
    const key = str((message as Row).thread_id);
    const list = grouped.get(key) ?? [];
    list.push(mapMessage(message as Row));
    grouped.set(key, list);
  }

  const leadTyped: LeadVM = mapLead(lead as Row, tags.get(leadId) ?? []);

  return {
    lead: leadTyped,
    notes: (notes.data ?? []).map((row) => ({ id: str(row.id), body: str(row.body), createdAt: formatDateTime(row.created_at) })) as LeadNoteVM[],
    activities: (activities.data ?? []).map((row) => ({ id: str(row.id), type: str(row.activity_type), description: str(row.description), at: formatDateTime(row.occurred_at) })),
    threads: threadRows.map((row) => ({
      id: str(row.id),
      leadId,
      leadName: `${leadTyped.firstName} ${leadTyped.lastName}`.trim() || leadTyped.email,
      leadEmail: leadTyped.email,
      subject: str(row.subject),
      lastMessage: '',
      lastMessageAt: formatDateTime(row.last_message_at),
      unread: num(row.unread_count) > 0,
      campaign: '',
      status: row.is_archived ? 'archived' : 'inbox',
      messages: grouped.get(str(row.id)) ?? [],
    })),
  };
}

export async function getMailboxes(orgId: string): Promise<{ mailboxes: MailboxVM[]; providers: { gmail: boolean; outlook: boolean } }> {
  const db = createServiceClient();
  const { data } = await db
    .from('mailboxes')
    .select('id, email_address, display_name, provider, status, daily_limit, sent_today, warmup_enabled, reputation, last_sync_at, last_error, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });
  return {
    mailboxes: (data ?? []).map(mapMailbox),
    providers: {
      gmail: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      outlook: Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
    },
  };
}

export async function getTemplates(orgId: string): Promise<TemplateVM[]> {
  const db = createServiceClient();
  const { data } = await db
    .from('email_templates')
    .select('*')
    .eq('organization_id', orgId)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(500);
  return (data ?? []).map(mapTemplate);
}

export async function getInbox(orgId: string): Promise<ConversationThreadVM[]> {
  const db = createServiceClient();
  const { data: threads, error } = await db
    .from('email_threads')
    .select('*, lead:leads(id, first_name, last_name, email, company_name), campaign:campaigns(name)')
    .eq('organization_id', orgId)
    .order('last_message_at', { ascending: false })
    .limit(200);
  if (error) return [];

  const ids = (threads ?? []).map((row) => row.id as string);
  const { data: messages } = ids.length
    ? await db.from('email_messages').select('*').eq('organization_id', orgId).in('thread_id', ids).order('created_at', { ascending: true }).limit(3000)
    : { data: [] as Row[] };

  const grouped = new Map<string, MessageVM[]>();
  for (const message of messages ?? []) {
    const row = message as Row;
    const key = str(row.thread_id);
    const list = grouped.get(key) ?? [];
    list.push(mapMessage(row));
    grouped.set(key, list);
  }

  return (threads ?? []).map((row) => {
    const typed = row as Row;
    const lead = typed.lead as Row | null;
    const campaign = typed.campaign as Row | null;
    const list = grouped.get(str(typed.id)) ?? [];
    const last = list[list.length - 1];
    return {
      id: str(typed.id),
      leadId: typed.lead_id ? str(typed.lead_id) : null,
      leadName: lead ? `${str(lead.first_name)} ${str(lead.last_name)}`.trim() || str(lead.email) : str(typed.subject),
      leadEmail: lead ? str(lead.email) : '',
      subject: str(typed.subject),
      lastMessage: last?.body ?? '',
      lastMessageAt: formatRelative(typed.last_message_at),
      unread: num(typed.unread_count) > 0,
      campaign: campaign ? str(campaign.name) : 'No campaign',
      status: typed.is_archived ? 'archived' : last && !last.isOutbound ? 'replied' : 'inbox',
      assignedTo: typed.assigned_to ? str(typed.assigned_to) : null,
      messages: list,
    } satisfies ConversationThreadVM;
  });
}

export async function getOverview(orgId: string): Promise<OverviewVM> {
  const db = createServiceClient();
  const since = new Date(Date.now() - 56 * 86_400_000).toISOString();
  const [leads, campaigns, mailboxes, events, recentEvents] = await Promise.all([
    db.from('leads').select('status').eq('organization_id', orgId).is('deleted_at', null).limit(50000),
    db.from('campaigns').select('*, mailbox:mailboxes(email_address)').eq('organization_id', orgId).limit(1000),
    db.from('mailboxes').select('*').eq('organization_id', orgId).limit(200),
    db.from('email_events').select('event_type, occurred_at').eq('organization_id', orgId).gte('occurred_at', since).limit(20000),
    db.from('campaign_events').select('event_type, occurred_at, campaign:campaigns(name), lead:leads(first_name, last_name, email)').eq('organization_id', orgId).order('occurred_at', { ascending: false }).limit(8),
  ]);

  const campaignRows = (campaigns.data ?? []) as Row[];
  const mailboxRows = (mailboxes.data ?? []) as Row[];
  const eventCounts: Record<string, number> = {};
  const daily = new Map<string, { date: string; sent: number; replied: number; bounced: number }>();
  for (let i = 55; i >= 0; i -= 1) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    daily.set(key, { date: key, sent: 0, replied: 0, bounced: 0 });
  }
  for (const event of events.data ?? []) {
    const row = event as Row;
    const type = str(row.event_type);
    eventCounts[type] = (eventCounts[type] ?? 0) + 1;
    const day = daily.get(str(row.occurred_at).slice(0, 10));
    if (!day) continue;
    if (type === 'accepted') day.sent += 1;
    else if (type === 'replied') day.replied += 1;
    else if (type === 'bounced') day.bounced += 1;
  }
  const chartData: { date: string; sent: number; replied: number; bounced: number }[] = [];
  const dailyValues = [...daily.values()];
  for (let i = 0; i < dailyValues.length; i += 7) {
    const slice = dailyValues.slice(i, i + 7);
    chartData.push({
      date: slice[0]?.date?.slice(5) ?? '',
      sent: slice.reduce((sum, d) => sum + d.sent, 0),
      replied: slice.reduce((sum, d) => sum + d.replied, 0),
      bounced: slice.reduce((sum, d) => sum + d.bounced, 0),
    });
  }

  const totals = {
    totalLeads: leads.data?.length ?? 0,
    activeCampaigns: campaignRows.filter((row) => row.status === 'active').length,
    emailsSent: campaignRows.reduce((sum, row) => sum + num(row.emails_sent), 0),
    delivered: eventCounts.delivered ?? 0,
    replied: campaignRows.reduce((sum, row) => sum + num(row.replies), 0),
    bounced: campaignRows.reduce((sum, row) => sum + num(row.bounces), 0),
    unsubscribed: campaignRows.reduce((sum, row) => sum + num(row.unsubscribes), 0),
    sendingHealth: mailboxRows.length
      ? Math.round(
          mailboxRows.reduce((score, row) => {
            const rep = str(row.reputation);
            return score + (rep === 'excellent' ? 100 : rep === 'good' ? 85 : rep === 'fair' ? 65 : rep === 'poor' ? 35 : 50);
          }, 0) / mailboxRows.length,
        )
      : 0,
  };

  const activity = (recentEvents.data ?? []).map((event) => {
    const row = event as Row;
    const lead = row.lead as Row | null;
    const campaign = row.campaign as Row | null;
    const who = lead ? `${str(lead.first_name)} ${str(lead.last_name)}`.trim() || str(lead.email) : 'A lead';
    return {
      text: `${who} · ${str(row.event_type).replace(/_/g, ' ')}${campaign ? ` in ${str(campaign.name)}` : ''}`,
      time: formatRelative(row.occurred_at),
      dot: str(row.event_type).includes('bounce') ? 'bg-red-500' : str(row.event_type) === 'replied' ? 'bg-emerald-500' : 'bg-blue-500',
    };
  });

  const connected = mailboxRows.filter((row) => row.status === 'connected').length;
  const recommendations: string[] = [];
  if (!mailboxRows.length) recommendations.push('Connect a mailbox before launching your first campaign.');
  else if (connected < mailboxRows.length) recommendations.push(`${mailboxRows.length - connected} mailbox(es) need reconnecting before they can send.`);
  if (totals.activeCampaigns === 0 && campaignRows.some((row) => row.status === 'draft')) recommendations.push('Review your draft campaigns and schedule the next send window.');
  if (totals.bounced > 0 && totals.emailsSent > 0 && pct(totals.bounced, totals.emailsSent) > 3) recommendations.push('Your bounce rate is above 3%. Verify addresses before the next send.');
  if (!recommendations.length) recommendations.push('Keep daily volume conservative and personalise each message to protect reputation.');

  return {
    totals,
    chartData,
    campaigns: campaignRows.slice(0, 8).map(mapCampaign),
    mailboxes: mailboxRows.map(mapMailbox),
    activity: activity.length ? activity : [{ text: 'No campaign activity yet.', time: ' - ', dot: 'bg-slate-400' }],
    recommendations,
  };
}

export async function getAnalytics(orgId: string): Promise<AnalyticsVM> {
  const db = createServiceClient();
  const since = new Date(Date.now() - 56 * 86_400_000).toISOString();
  const [leads, campaigns, mailboxes, events, domains, recent] = await Promise.all([
    db.from('leads').select('status').eq('organization_id', orgId).is('deleted_at', null).limit(50000),
    db.from('campaigns').select('*, mailbox:mailboxes(email_address)').eq('organization_id', orgId).limit(2000),
    db.from('mailboxes').select('*').eq('organization_id', orgId).limit(200),
    db.from('email_events').select('event_type, occurred_at').eq('organization_id', orgId).gte('occurred_at', since).limit(20000),
    db.from('sending_domains').select('domain, status').eq('organization_id', orgId).limit(50),
    db.from('campaign_events').select('event_type, occurred_at, campaign:campaigns(name), lead:leads(first_name, last_name, email)').eq('organization_id', orgId).order('occurred_at', { ascending: false }).limit(20),
  ]);

  const campaignRows = (campaigns.data ?? []) as Row[];
  const mailboxRows = (mailboxes.data ?? []) as Row[];
  const sent = campaignRows.reduce((sum, row) => sum + num(row.emails_sent), 0);
  const replies = campaignRows.reduce((sum, row) => sum + num(row.replies), 0);
  const bounces = campaignRows.reduce((sum, row) => sum + num(row.bounces), 0);
  const unsubscribes = campaignRows.reduce((sum, row) => sum + num(row.unsubscribes), 0);

  const eventCounts: Record<string, number> = {};
  const daily = new Map<string, { date: string; sent: number; replied: number; bounced: number }>();
  for (let i = 55; i >= 0; i -= 1) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    daily.set(key, { date: key, sent: 0, replied: 0, bounced: 0 });
  }
  for (const event of events.data ?? []) {
    const row = event as Row;
    const type = str(row.event_type);
    eventCounts[type] = (eventCounts[type] ?? 0) + 1;
    const day = daily.get(str(row.occurred_at).slice(0, 10));
    if (!day) continue;
    if (type === 'accepted') day.sent += 1;
    else if (type === 'replied') day.replied += 1;
    else if (type === 'bounced') day.bounced += 1;
  }
  const chartData: { date: string; sent: number; replied: number; bounced: number }[] = [];
  const dailyValues = [...daily.values()];
  for (let i = 0; i < dailyValues.length; i += 7) {
    const slice = dailyValues.slice(i, i + 7);
    chartData.push({
      date: slice[0]?.date?.slice(5) ?? '',
      sent: slice.reduce((sum, d) => sum + d.sent, 0),
      replied: slice.reduce((sum, d) => sum + d.replied, 0),
      bounced: slice.reduce((sum, d) => sum + d.bounced, 0),
    });
  }

  return {
    totals: {
      totalLeads: leads.data?.length ?? 0,
      activeCampaigns: campaignRows.filter((row) => row.status === 'active').length,
      campaigns: campaignRows.length,
      emailsSent: sent,
      delivered: eventCounts.delivered ?? 0,
      opened: eventCounts.opened ?? 0,
      clicked: eventCounts.clicked ?? 0,
      replies,
      bounces,
      unsubscribes,
      bounceRate: pct(bounces, sent),
      replyRate: pct(replies, sent),
      unsubscribeRate: pct(unsubscribes, sent),
      sendingHealth: mailboxRows.length
        ? Math.round(
            mailboxRows.reduce((score, row) => {
              const rep = str(row.reputation);
              return score + (rep === 'excellent' ? 100 : rep === 'good' ? 85 : rep === 'fair' ? 65 : rep === 'poor' ? 35 : 50);
            }, 0) / mailboxRows.length,
          )
        : 0,
    },
    chartData,
    campaigns: campaignRows.slice(0, 20).map(mapCampaign),
    mailboxes: mailboxRows.map(mapMailbox),
    domains: (domains.data ?? []).map((row) => ({ domain: str((row as Row).domain), status: str((row as Row).status) })),
    recentActivity: (recent.data ?? []).map((row) => {
      const typed = row as Row;
      return { type: str(typed.event_type), at: formatDateTime(typed.occurred_at), lead: typed.lead, campaign: typed.campaign };
    }),
    eventCounts,
  };
}

export async function getSuppression(orgId: string) {
  const db = createServiceClient();
  const [entries, reasons] = await Promise.all([
    db.from('suppression_entries').select('*, reason:suppression_reasons(label)').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(1000),
    db.from('suppression_reasons').select('key, label, description'),
  ]);
  return {
    entries: (entries.data ?? []).map((row) => {
      const typed = row as Row;
      const reason = typed.reason as Row | null;
      return {
        id: str(typed.id),
        email: str(typed.email),
        reasonKey: str(typed.reason_key),
        reason: reason ? str(reason.label) : str(typed.reason_key),
        source: str(typed.source),
        notes: str(typed.notes),
        createdAt: formatDateTime(typed.created_at),
      };
    }),
    reasons: (reasons.data ?? []).map((row) => ({ key: str((row as Row).key), label: str((row as Row).label), description: str((row as Row).description) })),
  };
}

export async function getDeliverability(orgId: string) {
  const db = createServiceClient();
  const { data: domains } = await db.from('sending_domains').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
  const domainRows = (domains ?? []) as Row[];
  const checks = domainRows.length
    ? await db.from('domain_authentication_checks').select('*').eq('organization_id', orgId).in('domain_id', domainRows.map((row) => str(row.id))).order('checked_at', { ascending: false }).limit(500)
    : { data: [] as Row[] };
  return {
    domains: domainRows.map((row) => ({
      id: str(row.id),
      domain: str(row.domain),
      status: str(row.status),
      spfStatus: str(row.spf_status),
      dkimStatus: str(row.dkim_status),
      dmarcStatus: str(row.dmarc_status),
      dkimSelector: row.dkim_selector ? str(row.dkim_selector) : '',
      lastCheckedAt: formatDateTime(row.last_checked_at),
    })),
    checks: (checks.data ?? []).map((row) => {
      const typed = row as Row;
      return {
        id: str(typed.id),
        domainId: str(typed.domain_id),
        type: str(typed.check_type),
        status: str(typed.status),
        found: str(typed.record_found),
        expected: str(typed.expected),
        checkedAt: formatDateTime(typed.checked_at),
      };
    }),
  };
}

export async function getSupport(orgId: string) {
  const db = createServiceClient();
  const [tickets, categories, articles] = await Promise.all([
    db.from('support_tickets').select('*, messages:support_messages(id, body, author_type, created_at)').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100),
    db.from('support_categories').select('key, name'),
    db.from('kb_articles').select('slug, title, body, category').eq('is_published', true).order('title').limit(50),
  ]);
  return {
    tickets: (tickets.data ?? []).map((row) => {
      const typed = row as Row;
      return {
        id: str(typed.id),
        subject: str(typed.subject),
        description: str(typed.description),
        status: str(typed.status),
        priority: str(typed.priority),
        category: str(typed.category_key),
        createdAt: formatDateTime(typed.created_at),
        updatedAt: formatDateTime(typed.updated_at),
        messages: (Array.isArray(typed.messages) ? typed.messages : []).map((message) => {
          const m = message as Row;
          return { id: str(m.id), body: str(m.body), authorType: str(m.author_type), createdAt: formatDateTime(m.created_at) };
        }),
      };
    }),
    categories: (categories.data ?? []).map((row) => ({ key: str((row as Row).key), name: str((row as Row).name) })),
    articles: (articles.data ?? []).map((row) => ({ slug: str((row as Row).slug), title: str((row as Row).title), body: str((row as Row).body), category: str((row as Row).category) })),
  };
}

export async function getAutomations(orgId: string) {
  const db = createServiceClient();
  const [workflows, executions] = await Promise.all([
    db.from('automation_workflows').select('*, steps:automation_steps(id, step_order, step_type, config)').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100),
    db.from('automation_executions').select('status').eq('organization_id', orgId).limit(5000),
  ]);
  const executionCounts: Record<string, number> = {};
  for (const row of executions.data ?? []) {
    const key = str((row as Row).status);
    executionCounts[key] = (executionCounts[key] ?? 0) + 1;
  }
  return {
    workflows: (workflows.data ?? []).map((row) => {
      const typed = row as Row;
      return {
        id: str(typed.id),
        name: str(typed.name),
        description: str(typed.description),
        status: str(typed.status),
        triggerType: str(typed.trigger_type),
        steps: (Array.isArray(typed.steps) ? typed.steps : []).map((step) => {
          const s = step as Row;
          return { id: str(s.id), order: num(s.step_order), type: str(s.step_type) };
        }),
        createdAt: formatDateTime(typed.created_at),
      };
    }),
    executionCounts,
  };
}

export async function getWorkspaceSettings(orgId: string, userId: string) {
  const db = createServiceClient();
  const [profile, organization, memberships, plans] = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).maybeSingle(),
    db.from('organizations').select('*').eq('id', orgId).maybeSingle(),
    db.from('organization_members').select('user_id, role, status, invited_at, created_at').eq('organization_id', orgId).limit(200),
    db.from('subscription_plans').select('*').order('sort_order'),
  ]);
  return {
    profile: (profile.data ?? {}) as Row,
    organization: (organization.data ?? {}) as Row,
    members: (memberships.data ?? []).map((row) => {
      const typed = row as Row;
      return { userId: str(typed.user_id), role: str(typed.role), status: str(typed.status), joinedAt: formatDate(typed.created_at) };
    }),
    plans: (plans.data ?? []).map((row) => {
      const typed = row as Row;
      return { key: str(typed.key), name: str(typed.name), description: str(typed.description) };
    }),
  };
}

export async function getNotifications(userId: string) {
  const db = createServiceClient();
  const { data } = await db
    .from('notifications')
    .select('id, title, body, link, created_at, read_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []).map((row) => {
    const typed = row as Row;
    return {
      id: str(typed.id),
      title: str(typed.title),
      body: typed.body ? str(typed.body) : null,
      link: typed.link ? str(typed.link) : null,
      createdAt: str(typed.created_at),
      readAt: typed.read_at ? str(typed.read_at) : null,
    };
  });
}
