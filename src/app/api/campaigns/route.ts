import { withApi, ok, parseBody, parseQuery, requireApiSession, enforceRateLimit, writeAudit, assertRole, ApiError } from '@/lib/http';
import { campaignInputSchema, paginationSchema } from '@/lib/validation';
import { createServiceClient } from '@/lib/supabase/service';
import { createCampaign } from '@/lib/campaigns/create';

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
    const db = createServiceClient();

    const { campaign, excluded } = await createCampaign({
      db,
      organizationId: session.organizationId,
      userId: session.userId,
      data: input,
    });

    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.created', entityType: 'campaign', entityId: campaign.id as string, request });

    return ok({ ...toDto(campaign), excluded }, { status: 201 });
  });
}
