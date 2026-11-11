import { withApi, ok, parseBody, parseQuery, requireApiSession, enforceRateLimit, writeAudit, assertRole, ApiError } from '@/lib/http';
import { campaignInputSchema, paginationSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureCampaignSteps } from '@/lib/email/engine';
import { extractRawVariables, validateVariablesAgainstList, type LeadListColumn } from '@/lib/placeholders';
import { partitionSuppressed } from '@/lib/suppression';

export const dynamic = 'force-dynamic';

function toDto(row: Record<string, unknown>) {
  const mailbox = row.mailbox as { id: string; email_address: string } | null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    totalLeads: row.total_leads,
    emailsSent: row.emails_sent,
    replies: row.replies,
    bounces: row.bounces,
    unsubscribes: row.unsubscribes,
    createdAt: row.created_at,
    launchAt: row.launch_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    dailyLimit: row.daily_limit,
    timezone: row.timezone,
    templateId: row.template_id,
    mailbox: mailbox ? { id: mailbox.id, email_address: mailbox.email_address } : null,
  };
}

export async function GET(request: Request) {
  return withApi({ route: '/api/campaigns', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { page, pageSize } = parseQuery(request, paginationSchema);
    const db = createServiceClient();
    const from = (page - 1) * pageSize;
    const { data, error, count } = await db
      .from('campaigns')
      .select('id, name, description, status, total_leads, emails_sent, replies, bounces, unsubscribes, created_at, launch_at, started_at, completed_at, daily_limit, timezone, template_id, mailbox_id, mailbox:mailboxes(id, email_address)', { count: 'exact' })
      .eq('organization_id', session.organizationId)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new ApiError(500, 'Could not load campaigns.');
    // The payload stays an array; the pagination metadata rides in the headers.
    return ok((data ?? []).map(toDto), {
      headers: {
        'X-Total-Count': String(count ?? 0),
        'X-Page': String(page),
        'X-Page-Size': String(pageSize),
      },
    });
  });
}

export async function POST(request: Request) {
  return withApi({ route: '/api/campaigns', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'campaign-create', 30, 3600, session.userId);
    const input = await parseBody(request, campaignInputSchema);
    if (input.interval_min_seconds > input.interval_max_seconds) {
      throw new ApiError(422, 'The minimum sending interval cannot be longer than the maximum.');
    }
    const db = createServiceClient();

    if (input.mailbox_id) {
      const { data: mailbox } = await db.from('mailboxes').select('id, status').eq('id', input.mailbox_id).eq('organization_id', session.organizationId).maybeSingle();
      if (!mailbox) throw new ApiError(422, 'Choose a mailbox that belongs to this workspace.');
      if (mailbox.status === 'disconnected') throw new ApiError(422, 'Reconnect the chosen mailbox before creating a campaign.');
    }
    let listColumns: LeadListColumn[] | null = null;
    let templateRow: Record<string, unknown> | null = null;
    if (input.template_id) {
      const { data: template } = await db.from('email_templates').select('id, mode, ai_personalization, subject, body_text').eq('id', input.template_id).eq('organization_id', session.organizationId).is('archived_at', null).maybeSingle();
      if (!template) throw new ApiError(422, 'Choose a template that belongs to this workspace.');
      templateRow = template as Record<string, unknown>;
    }
    if (input.lead_list_id) {
      const { data: list } = await db.from('lead_lists').select('id, columns').eq('id', input.lead_list_id).eq('organization_id', session.organizationId).is('archived_at', null).maybeSingle();
      if (!list) throw new ApiError(422, 'Choose a lead list that belongs to this workspace.');
      listColumns = list.columns as LeadListColumn[];
    }
    if (!input.template_id && (!input.subject || !input.body)) {
      throw new ApiError(422, 'Provide a template or write a subject and body for this campaign.');
    }

    // Reject templates whose placeholders cannot be rendered for the chosen list.
    if (listColumns) {
      let sources = templateRow
        ? [String(templateRow.subject ?? ''), String(templateRow.body_text ?? '')]
        : [String(input.subject ?? ''), String(input.body ?? '')];
      if (templateRow?.mode === 'group' && input.template_id) {
        const { data: variants } = await db.from('email_template_variants').select('subject, body_text').eq('template_id', input.template_id);
        sources = sources.concat((variants ?? []).flatMap((v) => [String(v.subject ?? ''), String(v.body_text ?? '')]));
      }
      const used = extractRawVariables(...sources);
      const checks = validateVariablesAgainstList(used, listColumns);
      const unsupported = checks.filter((check) => !check.supported).map((check) => `{{${check.key}}}`);
      if (unsupported.length) {
        throw new ApiError(422, `These placeholders have no matching column in the selected lead list: ${unsupported.join(', ')}`, 'unsupported_placeholders');
      }
    }

    const { data: allowed } = await db.rpc('check_org_limit', { p_org: session.organizationId, p_metric: 'campaigns', p_increment: 1 });
    if (allowed === false) throw new ApiError(402, 'This workspace has reached its campaign limit. Upgrade to create more.', 'plan_limit');

    let templateId = input.template_id ?? null;
    if (!templateId && input.subject && input.body) {
      const { data: template, error: templateError } = await db
        .from('email_templates')
        .insert({
          organization_id: session.organizationId,
          name: `${input.name.slice(0, 140)} - message`,
          subject: input.subject,
          body_text: input.body,
          body_html: '',
          category: 'Campaign',
          created_by: session.userId,
        })
        .select('id')
        .single();
      if (templateError || !template) throw new ApiError(500, 'Could not save the campaign message.');
      templateId = template.id as string;
    }

    const aiPersonalization = input.ai_personalization || Boolean(templateRow?.ai_personalization);
    const { data: campaign, error } = await db
      .from('campaigns')
      .insert({
        organization_id: session.organizationId,
        name: input.name,
        description: input.description ?? null,
        mailbox_id: input.mailbox_id ?? null,
        template_id: templateId,
        lead_list_id: input.lead_list_id ?? null,
        interval_min_seconds: input.interval_min_seconds,
        interval_max_seconds: input.interval_max_seconds,
        ai_personalization: aiPersonalization,
        timezone: input.timezone,
        daily_limit: input.daily_limit,
        status: 'draft',
        created_by: session.userId,
      })
      .select('*')
      .single();
    if (error || !campaign) throw new ApiError(500, 'Could not create the campaign.');

    await db.from('campaign_settings').insert({
      organization_id: session.organizationId,
      campaign_id: campaign.id,
      stop_on_reply: input.stop_on_reply,
      max_followups: input.follow_up_days && input.follow_up_days > 0 ? 1 : 0,
      send_window_start: input.send_window_start,
      send_window_end: input.send_window_end,
      weekdays: input.weekdays,
      settings: {
        subject_override: input.subject ?? '',
        body_override: input.body ?? '',
        follow_up_days: input.follow_up_days ?? 0,
        stop_on_reply: input.stop_on_reply,
        max_followups: input.follow_up_days && input.follow_up_days > 0 ? 1 : 0,
      },
    });

    // Build the recipient set. A lead list is the primary source; ad-hoc lead
    // ids are still supported for backwards compatibility.
    let candidateIds: string[] = input.lead_ids.slice(0, 10000);
    if (input.lead_list_id) {
      const { data: listLeads } = await db
        .from('leads')
        .select('id')
        .eq('organization_id', session.organizationId)
        .eq('lead_list_id', input.lead_list_id)
        .is('deleted_at', null)
        .not('status', 'in', '(unsubscribed,bounced,not_interested)')
        .limit(10000);
      const seen = new Set<string>(candidateIds);
      for (const lead of listLeads ?? []) {
        const id = String(lead.id);
        if (!seen.has(id)) { seen.add(id); candidateIds.push(id); }
      }
    }
    let excludedCount = 0;
    if (candidateIds.length) {
      const { data: validLeads } = await db
        .from('leads')
        .select('id, email')
        .eq('organization_id', session.organizationId)
        .is('deleted_at', null)
        .in('id', candidateIds);
      const { suppressed } = await partitionSuppressed(db, session.organizationId, (validLeads ?? []).map((lead) => String(lead.email)));
      const blockedInDb = new Set<string>(suppressed);
      const excludeSet = new Set(input.exclude_lead_ids);
      const rows = (validLeads ?? [])
        .filter((lead) => {
          if (excludeSet.has(String(lead.id))) { excludedCount += 1; return false; }
          if (blockedInDb.has(String(lead.email).trim().toLowerCase())) { excludedCount += 1; return false; }
          return true;
        })
        .map((lead) => lead.id as string)
        .map((leadId) => ({
          organization_id: session.organizationId,
          campaign_id: campaign.id,
          lead_id: leadId,
          status: 'queued',
        }));
      if (rows.length) await db.from('campaign_leads').upsert(rows, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true });
      await db.from('campaigns').update({ total_leads: rows.length }).eq('id', campaign.id);
    }

    await ensureCampaignSteps(campaign);
    await db.rpc('record_usage', { p_org: session.organizationId, p_metric: 'campaigns', p_quantity: 1 }).then(() => undefined, () => undefined);
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.created', entityType: 'campaign', entityId: campaign.id as string, request });

    return ok({ ...toDto(campaign), excluded: excludedCount }, { status: 201 });
  });
}
