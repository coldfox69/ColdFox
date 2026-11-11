import { withApi, ok, requireApiSession, writeAudit, assertRole, ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/campaigns/[id]', method: 'GET' }, async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const db = createServiceClient();
    const { data: campaign, error } = await db
      .from('campaigns')
      .select('*, mailbox:mailboxes(id, email_address, display_name, status), template:email_templates(id, name, subject, body_text)')
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .maybeSingle();
    if (error || !campaign) throw new ApiError(404, 'Campaign not found.', 'not_found');

    const [settings, steps, executions, leads, executionStatusRows] = await Promise.all([
      db.from('campaign_settings').select('*').eq('campaign_id', id).maybeSingle(),
      db.from('campaign_steps').select('*').eq('campaign_id', id).order('step_order'),
      db.from('campaign_executions').select('id, step_order, status, scheduled_for, started_at, finished_at, error, provider_message_id, variant_id, personalized, lead:leads(id, first_name, last_name, email)').eq('campaign_id', id).order('scheduled_for', { ascending: false }).limit(100),
      db.from('campaign_leads').select('id, status, current_step, last_sent_at, next_send_at, error, lead:leads(id, first_name, last_name, email, company_name)').eq('campaign_id', id).limit(500),
      db.from('campaign_executions').select('status, variant_id').eq('campaign_id', id).limit(100000),
    ]);

    // Exact per-status breakdown, no campaign rows are copied to the client.
    const statusCounts: Record<string, number> = {};
    const variantCounts: Record<string, number> = {};
    for (const row of executionStatusRows.data ?? []) {
      const key = String((row as Record<string, unknown>).status);
      statusCounts[key] = (statusCounts[key] ?? 0) + 1;
      const variantId = (row as Record<string, unknown>).variant_id;
      if (variantId) variantCounts[String(variantId)] = (variantCounts[String(variantId)] ?? 0) + 1;
    }
    const terminal = ['accepted', 'delivered', 'failed', 'skipped', 'cancelled', 'replied', 'bounced', 'unsubscribed'];
    const total = executionStatusRows.data?.length ?? Number(campaign.total_leads ?? 0);
    const done = terminal.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0);
    const stats = {
      totalRecipients: Number(campaign.total_leads ?? 0),
      executions: total,
      queued: (statusCounts['queued'] ?? 0) + (statusCounts['processing'] ?? 0),
      sent: statusCounts['accepted'] ?? 0,
      accepted: statusCounts['accepted'] ?? 0,
      skipped: statusCounts['skipped'] ?? 0,
      failed: statusCounts['failed'] ?? 0,
      bounces: Number(campaign.bounces ?? 0),
      replies: Number(campaign.replies ?? 0),
      unsubscribes: Number(campaign.unsubscribes ?? 0),
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      variants: variantCounts,
    };

    let templateVariants: { id: string; variant_order: number; subject: string }[] = [];
    const templateId = campaign.template_id as string | null;
    if (templateId) {
      const { data: variants } = await db.from('email_template_variants').select('id, variant_order, subject').eq('template_id', templateId).order('variant_order');
      templateVariants = (variants ?? []) as { id: string; variant_order: number; subject: string }[];
    }

    return ok({
      campaign,
      settings: settings.data,
      steps: steps.data ?? [],
      executions: executions.data ?? [],
      leads: leads.data ?? [],
      stats,
      variants: templateVariants,
    });
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/campaigns/[id]', method: 'PATCH' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const db = createServiceClient();
    const { data: existing } = await db.from('campaigns').select('id, status').eq('id', id).eq('organization_id', session.organizationId).maybeSingle();
    if (!existing) throw new ApiError(404, 'Campaign not found.', 'not_found');
    if (['active', 'scheduled'].includes(String(existing.status))) throw new ApiError(409, 'Pause the campaign before editing it.', 'campaign_running');

    const update: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim().slice(0, 160);
    if (typeof body.description === 'string' || body.description === null) update.description = body.description;
    if (typeof body.daily_limit === 'number') update.daily_limit = Math.max(1, Math.min(2000, Math.round(body.daily_limit)));
    if (typeof body.mailbox_id === 'string' || body.mailbox_id === null) update.mailbox_id = body.mailbox_id;
    if (Object.keys(update).length) {
      const { error } = await db.from('campaigns').update(update).eq('id', id);
      if (error) throw new ApiError(500, 'Could not update the campaign.');
    }
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.updated', entityType: 'campaign', entityId: id, request });
    return ok({ updated: true });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi({ route: '/api/campaigns/[id]', method: 'DELETE' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin']);
    const { id } = await params;
    const db = createServiceClient();
    const { data, error } = await db
      .from('campaigns')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', session.organizationId)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new ApiError(404, 'Campaign not found.', 'not_found');
    await db.from('campaign_executions').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('campaign_id', id).in('status', ['queued', 'processing']);
    await writeAudit({ organizationId: session.organizationId, actorId: session.userId, actorEmail: session.email, action: 'campaign.cancelled', entityType: 'campaign', entityId: id, request });
    return ok({ cancelled: true });
  });
}
