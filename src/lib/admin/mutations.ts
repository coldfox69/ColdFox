import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, writeAudit } from '@/lib/http';
import type { ApiSession } from '@/lib/auth/api-session';
import { syncLeadTags } from '@/lib/leads';
import { LEAD_STATUSES } from '@/lib/validation';

type Body = Record<string, unknown>;
type Row = Record<string, unknown>;

const LEAD_FIELDS = [
  'first_name', 'last_name', 'email', 'company_name', 'job_title', 'phone',
  'linkedin_url', 'website', 'industry', 'city', 'country', 'status', 'source',
  'next_follow_up_at',
] as const;

function text(value: unknown, max = 5000) {
  if (value === null || value === undefined) return null;
  return String(value).trim().slice(0, max);
}

function number(value: unknown, min: number, max: number, fallback?: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function bool(value: unknown) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function jsonValue(value: unknown, fallback: unknown) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new ApiError(422, 'Invalid JSON value.');
    }
  }
  return value;
}

function requireId(body: Body) {
  const id = text(body.id, 100);
  if (!id) throw new ApiError(422, 'Missing record id.');
  return id;
}

function valuesOf(body: Body): Body {
  return (body.values && typeof body.values === 'object' ? body.values : body) as Body;
}

function slugify(value: string) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'workspace';
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ticket categories are a foreign key, so validate before writing. */
async function requireCategory(db: SupabaseClient, value: unknown) {
  const key = text(value, 60);
  if (!key) return null;
  const { data } = await db.from('support_categories').select('key').eq('key', key).maybeSingle();
  if (!data) throw new ApiError(422, 'Unknown support category.', 'invalid_category');
  return key;
}

async function findUserByEmail(db: SupabaseClient, email: string): Promise<{ id: string; email?: string | null } | null> {
  const needle = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page += 1) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const found = data.users.find((user) => (user.email ?? '').toLowerCase() === needle);
    if (found) return { id: found.id, email: found.email };
    if (data.users.length < 1000) break;
  }
  return null;
}

async function audit(
  session: ApiSession,
  request: Request,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  organizationId?: string | null,
) {
  await writeAudit({
    actorId: session.userId,
    actorEmail: session.email,
    action,
    entityType,
    entityId,
    metadata,
    organizationId: organizationId ?? null,
    request,
  });
}

/** Snapshot only the fields an operator can change, never secrets. */
function snapshot(row: Row | null | undefined, keys: string[]) {
  if (!row) return null;
  const out: Row = {};
  for (const key of keys) if (key in row) out[key] = row[key];
  return out;
}

async function ensureNotSelf(session: ApiSession, id: string, action: string) {
  if (session.userId === id) throw new ApiError(409, `You cannot ${action} your own account.`, 'self_target');
}

async function ensureAnotherSuperAdmin(db: SupabaseClient, targetId: string) {
  const { data: target } = await db.from('platform_admins').select('role').eq('user_id', targetId).maybeSingle();
  if (target?.role !== 'super_admin') return;
  const { count } = await db.from('platform_admins').select('user_id', { count: 'exact', head: true }).eq('role', 'super_admin');
  if ((count ?? 0) <= 1) throw new ApiError(409, 'At least one super admin must remain.', 'last_super_admin');
}

export async function mutateModule(input: {
  db: SupabaseClient;
  module: string;
  body: Body;
  session: ApiSession;
  request: Request;
}): Promise<{ status?: number; data: unknown }> {
  const { db, module, body, session, request } = input;
  const action = text(body.action, 60) ?? 'update';
  const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 500) : [];
  const values = valuesOf(body);
  const id = text(body.id, 100);

  switch (module) {
    case 'users': {
      const userId = id ?? '';
      if (!userId) throw new ApiError(422, 'Missing user id.');
      if (action === 'delete' || action === 'remove') {
        await ensureNotSelf(session, userId, 'delete');
        const { data: owned } = await db
          .from('organizations')
          .select('id, name, deleted_at')
          .eq('owner_id', userId);
        const active = (owned ?? []).filter((row) => !row.deleted_at);
        if (active.length) throw new ApiError(409, 'This user still owns a workspace. Transfer or delete the workspace first.', 'owns_workspace');
        // Soft-deleted workspaces keep the owner foreign key, which blocks the
        // auth delete. They are already deleted, so purge them with the user.
        for (const org of owned ?? []) {
          await audit(session, request, 'admin.organization.purged', 'organization', String(org.id), { name: org.name, reason: 'owner_deleted' }, String(org.id));
        }
        if (owned?.length) {
          const { error: purgeError } = await db.from('organizations').delete().in('id', owned.map((row) => String(row.id)));
          if (purgeError) throw new ApiError(500, 'Could not remove the deleted workspaces still owned by this user.');
        }
        const { error } = await db.auth.admin.deleteUser(userId);
        if (error) throw new ApiError(500, `Could not delete the user: ${error.message}`);
        await audit(session, request, 'admin.user.deleted', 'user', userId);
        return { data: { deleted: true } };
      }
      if (action === 'suspend' || action === 'activate') {
        await ensureNotSelf(session, userId, action === 'suspend' ? 'suspend' : 'activate');
        const { error } = await db.auth.admin.updateUserById(userId, {
          ban_duration: action === 'suspend' ? '876000h' : 'none',
        });
        if (error) throw new ApiError(500, `Could not ${action} the user: ${error.message}`);
        await audit(session, request, `admin.user.${action === 'suspend' ? 'suspended' : 'reactivated'}`, 'user', userId);
        return { data: { status: action === 'suspend' ? 'suspended' : 'active' } };
      }
      if (action === 'update') {
        const updates: Record<string, unknown> = {};
        const metadata: Record<string, unknown> = {};
        if (values.full_name !== undefined) {
          updates.full_name = text(values.full_name, 120);
          metadata.full_name = updates.full_name;
        }
        if (values.job_title !== undefined) updates.job_title = text(values.job_title, 120);
        if (values.phone !== undefined) updates.phone = text(values.phone, 40);
        if (values.timezone !== undefined) updates.timezone = text(values.timezone, 64);
        const email = text(values.email, 254);
        if (email) {
          const { error } = await db.auth.admin.updateUserById(userId, { email, email_confirm: true });
          if (error) throw new ApiError(500, `Could not update the email: ${error.message}`);
        }
        if (Object.keys(updates).length || Object.keys(metadata).length) {
          const { error } = await db.from('profiles').upsert({ id: userId, ...updates }, { onConflict: 'id' });
          if (error) throw new ApiError(500, 'Could not update the profile.');
          if (Object.keys(metadata).length) {
            await db.auth.admin.updateUserById(userId, { user_metadata: metadata });
          }
        }
        await audit(session, request, 'admin.user.updated', 'user', userId, { fields: Object.keys(values) });
        return { data: { updated: true } };
      }
      throw new ApiError(405, 'Unsupported user action.');
    }

    case 'organizations': {
      if (action === 'create') {
        const name = text(values.name, 120);
        if (!name || name.length < 2) throw new ApiError(422, 'Enter an organization name.');
        const ownerEmail = text(values.owner_email, 254);
        if (!ownerEmail) throw new ApiError(422, 'Enter the owner email.');
        const owner = await findUserByEmail(db, ownerEmail);
        if (!owner) throw new ApiError(404, 'No registered user has that email address.', 'owner_not_found');
        const planKey = text(values.plan_key, 40) ?? 'free';
        const { data: plan } = await db.from('subscription_plans').select('key').eq('key', planKey).maybeSingle();
        if (!plan) throw new ApiError(422, 'Unknown subscription plan.');
        const { data: org, error } = await db
          .from('organizations')
          .insert({
            name,
            slug: text(values.slug, 80) || slugify(name),
            website: text(values.website, 300),
            industry: text(values.industry, 120),
            company_size: text(values.company_size, 60),
            owner_id: owner.id,
            plan_key: planKey,
          })
          .select('id')
          .single();
        if (error || !org) throw new ApiError(500, `Could not create the organization: ${error?.message ?? 'unknown error'}`);
        await db.from('organization_members').upsert(
          { organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active', invited_by: session.userId },
          { onConflict: 'organization_id,user_id' },
        );
        await db.from('subscriptions').upsert(
          { organization_id: org.id, plan_key: planKey, status: 'active' },
          { onConflict: 'organization_id' },
        );
        await audit(session, request, 'admin.organization.created', 'organization', String(org.id), { name, owner_email: ownerEmail, plan_key: planKey }, String(org.id));
        return { status: 201, data: { id: org.id } };
      }
      const orgId = id ?? '';
      if (!orgId) throw new ApiError(422, 'Missing organization id.');
      const { data: existing } = await db.from('organizations').select('*').eq('id', orgId).maybeSingle();
      if (!existing) throw new ApiError(404, 'Organization not found.');

      if (action === 'suspend' || action === 'restore') {
        const { error } = await db
          .from('organizations')
          .update({ is_suspended: action === 'suspend', suspended_reason: action === 'suspend' ? text(values.reason, 500) : null })
          .eq('id', orgId);
        if (error) throw new ApiError(500, 'Could not change the organization status.');
        await audit(session, request, `admin.organization.${action === 'suspend' ? 'suspended' : 'restored'}`, 'organization', orgId, { before: existing.is_suspended, after: action === 'suspend' }, orgId);
        return { data: { status: action === 'suspend' ? 'suspended' : 'active' } };
      }
      if (action === 'change_plan') {
        const planKey = text(values.plan_key, 40);
        if (!planKey) throw new ApiError(422, 'Choose a plan.');
        const { data: plan } = await db.from('subscription_plans').select('key, is_active').eq('key', planKey).maybeSingle();
        if (!plan || !plan.is_active) throw new ApiError(422, 'That plan is not available.');
        await db.from('organizations').update({ plan_key: planKey }).eq('id', orgId);
        await db.from('subscriptions').upsert(
          { organization_id: orgId, plan_key: planKey, status: 'active', updated_at: new Date().toISOString() },
          { onConflict: 'organization_id' },
        );
        await audit(session, request, 'admin.organization.plan_changed', 'organization', orgId, { before: existing.plan_key, after: planKey }, orgId);
        return { data: { plan_key: planKey } };
      }
      if (action === 'update') {
        const update: Record<string, unknown> = {};
        for (const key of ['name', 'website', 'industry', 'company_size', 'timezone', 'admin_notes', 'suspended_reason'] as const) {
          if (values[key] !== undefined) update[key] = text(values[key], key === 'admin_notes' || key === 'suspended_reason' ? 2000 : 300);
        }
        if (values.slug !== undefined) update.slug = text(values.slug, 80) || existing.slug;
        if (!Object.keys(update).length) throw new ApiError(422, 'No changes supplied.');
        const { error } = await db.from('organizations').update(update).eq('id', orgId);
        if (error) throw new ApiError(error.code === '23505' ? 409 : 500, error.code === '23505' ? 'That slug is already in use.' : 'Could not update the organization.');
        await audit(session, request, 'admin.organization.updated', 'organization', orgId, { before: snapshot(existing, ['name', 'slug', 'website', 'industry', 'company_size']), after: update }, orgId);
        return { data: { updated: true } };
      }
      if (action === 'delete') {
        const { error } = await db.from('organizations').update({ deleted_at: new Date().toISOString(), is_suspended: true }).eq('id', orgId);
        if (error) throw new ApiError(500, 'Could not delete the organization.');
        await audit(session, request, 'admin.organization.deleted', 'organization', orgId, { name: existing.name }, orgId);
        return { data: { deleted: true } };
      }
      throw new ApiError(405, 'Unsupported organization action.');
    }

    case 'leads': {
      if (action === 'create') {
        const organizationId = text(values.organization_id, 100);
        const email = text(values.email, 254);
        if (!organizationId) throw new ApiError(422, 'Choose an organization.');
        if (!email) throw new ApiError(422, 'Enter an email address.');
        const insert: Record<string, unknown> = { organization_id: organizationId, email, created_by: session.userId };
        for (const field of LEAD_FIELDS) if (field !== 'email' && values[field] !== undefined) insert[field] = text(values[field], 300);
        if (insert.status && !LEAD_STATUSES.includes(insert.status as (typeof LEAD_STATUSES)[number])) throw new ApiError(422, 'Unknown lead status.');
        const { data, error } = await db.from('leads').insert(insert).select('id').single();
        if (error || !data) throw new ApiError(error?.code === '23505' ? 409 : 500, error?.code === '23505' ? 'That email already exists in the workspace.' : 'Could not create the lead.');
        const tags = Array.isArray(values.tags) ? values.tags.map(String) : [];
        if (tags.length) await syncLeadTags(db, organizationId, String(data.id), tags);
        await audit(session, request, 'admin.lead.created', 'lead', String(data.id), { email, organization_id: organizationId }, organizationId);
        return { status: 201, data: { id: data.id } };
      }
      const leadIds = ids.length ? ids : id ? [id] : [];
      if (!leadIds.length) throw new ApiError(422, 'Missing lead id.');
      if (action === 'restore') {
        const { error } = await db.from('leads').update({ deleted_at: null }).in('id', leadIds);
        if (error) throw new ApiError(500, 'Could not restore the lead.');
        await audit(session, request, 'admin.lead.restored', 'lead', leadIds.join(','), { count: leadIds.length });
        return { data: { restored: leadIds.length } };
      }
      if (action === 'delete') {
        const { error } = await db.from('leads').update({ deleted_at: new Date().toISOString() }).in('id', leadIds);
        if (error) throw new ApiError(500, 'Could not delete the lead.');
        await audit(session, request, 'admin.lead.deleted', 'lead', leadIds.join(','), { count: leadIds.length });
        return { data: { deleted: leadIds.length } };
      }
      if (action === 'set_status') {
        const status = text(values.status, 40);
        if (!status || !LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) throw new ApiError(422, 'Unknown lead status.');
        const { error } = await db.from('leads').update({ status }).in('id', leadIds);
        if (error) throw new ApiError(500, 'Could not change the lead status.');
        await audit(session, request, 'admin.lead.status_changed', 'lead', leadIds.join(','), { status, count: leadIds.length });
        return { data: { updated: leadIds.length } };
      }
      if (action === 'update') {
        const leadId = leadIds[0];
        const { data: existing } = await db.from('leads').select('*').eq('id', leadId).maybeSingle();
        if (!existing) throw new ApiError(404, 'Lead not found.');
        const update: Record<string, unknown> = {};
        for (const field of LEAD_FIELDS) {
          if (values[field] !== undefined) update[field] = text(values[field], 500);
        }
        if (update.status && !LEAD_STATUSES.includes(update.status as (typeof LEAD_STATUSES)[number])) throw new ApiError(422, 'Unknown lead status.');
        if (values.tags !== undefined && Array.isArray(values.tags)) {
          await syncLeadTags(db, String(existing.organization_id), leadId, values.tags.map(String));
        }
        if (Object.keys(update).length) {
          const { error } = await db.from('leads').update(update).eq('id', leadId);
          if (error) throw new ApiError(500, 'Could not update the lead.');
        }
        await audit(session, request, 'admin.lead.updated', 'lead', leadId, { before: snapshot(existing, [...LEAD_FIELDS]), after: update }, String(existing.organization_id));
        return { data: { updated: true } };
      }
      throw new ApiError(405, 'Unsupported lead action.');
    }

    case 'campaigns': {
      if (action === 'create') {
        const organizationId = text(values.organization_id, 100);
        const name = text(values.name, 160);
        if (!organizationId || !name) throw new ApiError(422, 'Choose an organization and enter a campaign name.');
        const { data, error } = await db
          .from('campaigns')
          .insert({
            organization_id: organizationId,
            name,
            description: text(values.description, 2000),
            daily_limit: number(values.daily_limit, 1, 2000, 100),
            created_by: session.userId,
          })
          .select('id')
          .single();
        if (error || !data) throw new ApiError(500, 'Could not create the campaign.');
        await db.from('campaign_settings').upsert({ organization_id: organizationId, campaign_id: data.id }, { onConflict: 'campaign_id' });
        await audit(session, request, 'admin.campaign.created', 'campaign', String(data.id), { name, organization_id: organizationId }, organizationId);
        return { status: 201, data: { id: data.id } };
      }
      const campaignIds = ids.length ? ids : id ? [id] : [];
      if (!campaignIds.length) throw new ApiError(422, 'Missing campaign id.');
      if (action === 'pause' || action === 'resume' || action === 'cancel' || action === 'archive' || action === 'restore') {
        const update: Record<string, unknown> = {};
        if (action === 'pause') update.status = 'paused';
        if (action === 'resume') {
          update.status = 'active';
          update.started_at = new Date().toISOString();
        }
        if (action === 'cancel') {
          update.status = 'cancelled';
          update.completed_at = new Date().toISOString();
        }
        if (action === 'archive') {
          update.status = 'paused';
          update.archived_at = new Date().toISOString();
        }
        if (action === 'restore') update.archived_at = null;
        const { error } = await db.from('campaigns').update(update).in('id', campaignIds);
        if (error) throw new ApiError(500, `Could not ${action} the campaign.`);
        if (action === 'cancel' || action === 'archive') {
          await db.from('campaign_executions').update({ status: 'cancelled', finished_at: new Date().toISOString() }).in('campaign_id', campaignIds).in('status', ['queued', 'processing']);
          await db.from('campaign_schedules').update({ status: 'cancelled' }).in('campaign_id', campaignIds).eq('status', 'pending');
        }
        await audit(session, request, `admin.campaign.${action}`, 'campaign', campaignIds.join(','), { count: campaignIds.length });
        return { data: { updated: campaignIds.length } };
      }
      if (action === 'update') {
        const campaignId = campaignIds[0];
        const { data: existing } = await db.from('campaigns').select('*').eq('id', campaignId).maybeSingle();
        if (!existing) throw new ApiError(404, 'Campaign not found.');
        const update: Record<string, unknown> = {};
        if (values.name !== undefined) update.name = text(values.name, 160);
        if (values.description !== undefined) update.description = text(values.description, 2000);
        if (values.daily_limit !== undefined) update.daily_limit = number(values.daily_limit, 1, 2000, 100);
        if (values.admin_notes !== undefined) update.admin_notes = text(values.admin_notes, 2000);
        if (!Object.keys(update).length) throw new ApiError(422, 'No changes supplied.');
        const { error } = await db.from('campaigns').update(update).eq('id', campaignId);
        if (error) throw new ApiError(500, 'Could not update the campaign.');
        await audit(session, request, 'admin.campaign.updated', 'campaign', campaignId, { before: snapshot(existing, ['name', 'description', 'daily_limit']), after: update }, String(existing.organization_id));
        return { data: { updated: true } };
      }
      if (action === 'delete') {
        const { data: existing } = await db.from('campaigns').select('id, status, name, organization_id').in('id', campaignIds);
        const blocked = (existing ?? []).filter((row) => !['draft', 'cancelled', 'completed'].includes(String(row.status)));
        if (blocked.length) throw new ApiError(409, 'Cancel running campaigns before deleting them.', 'campaign_running');
        const { error } = await db.from('campaigns').delete().in('id', campaignIds);
        if (error) throw new ApiError(500, 'Could not delete the campaign.');
        await audit(session, request, 'admin.campaign.deleted', 'campaign', campaignIds.join(','), { count: campaignIds.length });
        return { data: { deleted: campaignIds.length } };
      }
      throw new ApiError(405, 'Unsupported campaign action.');
    }

    case 'mailboxes': {
      const mailboxIds = ids.length ? ids : id ? [id] : [];
      if (!mailboxIds.length) throw new ApiError(422, 'Missing mailbox id.');
      if (action === 'enable' || action === 'disable') {
        if (action === 'enable') {
          const { data: creds } = await db.from('mailbox_credentials').select('mailbox_id').in('mailbox_id', mailboxIds);
          const withCreds = new Set((creds ?? []).map((row) => String(row.mailbox_id)));
          const missing = mailboxIds.filter((mailboxId) => !withCreds.has(mailboxId));
          if (missing.length) throw new ApiError(409, 'Connect the mailbox credentials before enabling it.', 'missing_credentials');
        }
        const { error } = await db
          .from('mailboxes')
          .update({ status: action === 'enable' ? 'connected' : 'disconnected', last_error: null })
          .in('id', mailboxIds);
        if (error) throw new ApiError(500, `Could not ${action} the mailbox.`);
        await audit(session, request, `admin.mailbox.${action}d`, 'mailbox', mailboxIds.join(','), { count: mailboxIds.length });
        return { data: { updated: mailboxIds.length } };
      }
      if (action === 'disconnect') {
        await db.from('mailbox_credentials').delete().in('mailbox_id', mailboxIds);
        await db.from('mailboxes').update({ status: 'disconnected' }).in('id', mailboxIds);
        await audit(session, request, 'admin.mailbox.disconnected', 'mailbox', mailboxIds.join(','), { count: mailboxIds.length });
        return { data: { disconnected: mailboxIds.length } };
      }
      if (action === 'update') {
        const mailboxId = mailboxIds[0];
        const { data: existing } = await db.from('mailboxes').select('*').eq('id', mailboxId).maybeSingle();
        if (!existing) throw new ApiError(404, 'Mailbox not found.');
        const update: Record<string, unknown> = {};
        if (values.daily_limit !== undefined) update.daily_limit = number(values.daily_limit, 1, 2000, 100);
        if (values.display_name !== undefined) update.display_name = text(values.display_name, 120);
        if (values.warmup_enabled !== undefined) update.warmup_enabled = bool(values.warmup_enabled);
        if (values.admin_notes !== undefined) update.admin_notes = text(values.admin_notes, 2000);
        if (!Object.keys(update).length) throw new ApiError(422, 'No changes supplied.');
        const { error } = await db.from('mailboxes').update(update).eq('id', mailboxId);
        if (error) throw new ApiError(500, 'Could not update the mailbox.');
        await audit(session, request, 'admin.mailbox.updated', 'mailbox', mailboxId, { before: snapshot(existing, ['daily_limit', 'display_name', 'warmup_enabled']), after: update }, String(existing.organization_id));
        return { data: { updated: true } };
      }
      if (action === 'delete') {
        await db.from('mailbox_credentials').delete().in('mailbox_id', mailboxIds);
        const { error } = await db.from('mailboxes').delete().in('id', mailboxIds);
        if (error) throw new ApiError(500, 'Could not delete the mailbox.');
        await audit(session, request, 'admin.mailbox.deleted', 'mailbox', mailboxIds.join(','), { count: mailboxIds.length });
        return { data: { deleted: mailboxIds.length } };
      }
      throw new ApiError(405, 'Unsupported mailbox action.');
    }

    case 'subscriptions': {
      if (action === 'create') {
        const organizationId = text(values.organization_id, 100);
        const planKey = text(values.plan_key, 40);
        if (!organizationId || !planKey) throw new ApiError(422, 'Choose an organization and a plan.');
        const { error } = await db.from('subscriptions').upsert(
          { organization_id: organizationId, plan_key: planKey, status: text(values.status, 40) ?? 'active' },
          { onConflict: 'organization_id' },
        );
        if (error) throw new ApiError(500, 'Could not create the subscription.');
        await db.from('organizations').update({ plan_key: planKey }).eq('id', organizationId);
        await audit(session, request, 'admin.subscription.created', 'subscription', organizationId, { plan_key: planKey }, organizationId);
        return { status: 201, data: { organization_id: organizationId } };
      }
      const subId = id ?? '';
      if (!subId) throw new ApiError(422, 'Missing subscription id.');
      const { data: existing } = await db.from('subscriptions').select('*').eq('id', subId).maybeSingle();
      if (!existing) throw new ApiError(404, 'Subscription not found.');
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (values.plan_key !== undefined) update.plan_key = text(values.plan_key, 40);
      if (values.status !== undefined) update.status = text(values.status, 40);
      if (values.current_period_end !== undefined) update.current_period_end = values.current_period_end || null;
      if (values.cancel_at_period_end !== undefined) update.cancel_at_period_end = bool(values.cancel_at_period_end);
      if (values.trial_ends_at !== undefined) update.trial_ends_at = values.trial_ends_at || null;
      const { error } = await db.from('subscriptions').update(update).eq('id', subId);
      if (error) throw new ApiError(500, 'Could not update the subscription.');
      if (update.plan_key) await db.from('organizations').update({ plan_key: update.plan_key }).eq('id', existing.organization_id);
      await audit(session, request, 'admin.subscription.updated', 'subscription', subId, { before: snapshot(existing, ['plan_key', 'status', 'cancel_at_period_end']), after: update }, String(existing.organization_id));
      return { data: { updated: true } };
    }

    case 'plans': {
      if (action === 'create' || action === 'update') {
        const key = text(values.key, 40) ?? id;
        const name = text(values.name, 80);
        if (!key || !name) throw new ApiError(422, 'A plan key and name are required.');
        const payload = {
          key,
          name,
          description: text(values.description, 500),
          price_monthly: number(values.price_monthly, 0, 100000, 0),
          currency: text(values.currency, 8) ?? 'USD',
          limits: jsonValue(values.limits, {}),
          features: jsonValue(values.features, []),
          is_active: values.is_active === undefined ? true : bool(values.is_active),
          sort_order: number(values.sort_order, 0, 1000, 0),
        };
        const { error } = await db.from('subscription_plans').upsert(payload, { onConflict: 'key' });
        if (error) throw new ApiError(500, `Could not save the plan: ${error.message}`);
        await audit(session, request, `admin.plan.${action === 'create' ? 'created' : 'updated'}`, 'subscription_plan', key, { name, price_monthly: payload.price_monthly });
        return { data: { key } };
      }
      const planKey = id ?? '';
      if (!planKey) throw new ApiError(422, 'Missing plan key.');
      if (action === 'delete') {
        const { count } = await db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('plan_key', planKey);
        if ((count ?? 0) > 0) {
          await db.from('subscription_plans').update({ is_active: false }).eq('key', planKey);
          await audit(session, request, 'admin.plan.deactivated', 'subscription_plan', planKey);
          return { data: { deactivated: true, reason: 'Plan has subscribers, so it was deactivated instead of deleted.' } };
        }
        const { error } = await db.from('subscription_plans').delete().eq('key', planKey);
        if (error) throw new ApiError(500, 'Could not delete the plan.');
        await audit(session, request, 'admin.plan.deleted', 'subscription_plan', planKey);
        return { data: { deleted: true } };
      }
      throw new ApiError(405, 'Unsupported plan action.');
    }

    case 'billing': {
      const invoiceId = id ?? '';
      if (!invoiceId) throw new ApiError(422, 'Missing invoice id.');
      if (action === 'void_invoice') {
        const { data: invoice } = await db.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
        if (!invoice) throw new ApiError(404, 'Invoice not found.');
        if (invoice.status === 'paid') throw new ApiError(409, 'Paid invoices cannot be voided.');
        await db.from('invoices').update({ status: 'void' }).eq('id', invoiceId);
        await audit(session, request, 'admin.invoice.voided', 'invoice', invoiceId, { before: invoice.status, after: 'void' }, String(invoice.organization_id));
        return { data: { status: 'void' } };
      }
      throw new ApiError(405, 'Unsupported billing action.');
    }

    case 'tickets': {
      if (action === 'create') {
        const organizationId = text(values.organization_id, 100);
        const subject = text(values.subject, 200);
        const description = text(values.description, 5000);
        if (!organizationId || !subject || !description) throw new ApiError(422, 'Choose an organization and fill in the subject and description.');
        const categoryKey = await requireCategory(db, values.category_key);
        const { data, error } = await db
          .from('support_tickets')
          .insert({
            organization_id: organizationId,
            user_id: session.userId,
            subject,
            description,
            priority: text(values.priority, 20) ?? 'normal',
            category_key: categoryKey,
          })
          .select('id')
          .single();
        if (error || !data) throw new ApiError(500, 'Could not create the ticket.');
        await audit(session, request, 'admin.ticket.created', 'support_ticket', String(data.id), { subject }, organizationId);
        return { status: 201, data: { id: data.id } };
      }
      const ticketId = id ?? '';
      if (!ticketId) throw new ApiError(422, 'Missing ticket id.');
      const { data: ticket } = await db.from('support_tickets').select('*').eq('id', ticketId).maybeSingle();
      if (!ticket) throw new ApiError(404, 'Ticket not found.');
      if (action === 'reply' || action === 'internal_note') {
        const message = text(values.message, 5000);
        if (!message) throw new ApiError(422, 'Write a message first.');
        const internal = action === 'internal_note';
        const { error } = await db.from('support_messages').insert({
          organization_id: ticket.organization_id,
          ticket_id: ticketId,
          author_id: session.userId,
          author_type: 'admin',
          body: message,
          is_internal: internal,
        });
        if (error) throw new ApiError(500, 'Could not save the message.');
        await db.from('support_tickets').update({ status: internal ? ticket.status : 'waiting', updated_at: new Date().toISOString() }).eq('id', ticketId);
        await audit(session, request, `admin.ticket.${action}`, 'support_ticket', ticketId, { internal }, String(ticket.organization_id));
        return { data: { posted: true } };
      }
      if (action === 'resolve' || action === 'reopen') {
        const resolving = action === 'resolve';
        const { error } = await db
          .from('support_tickets')
          .update({ status: resolving ? 'resolved' : 'open', resolved_at: resolving ? new Date().toISOString() : null })
          .eq('id', ticketId);
        if (error) throw new ApiError(500, 'Could not update the ticket.');
        await audit(session, request, `admin.ticket.${action}`, 'support_ticket', ticketId, {}, String(ticket.organization_id));
        return { data: { status: resolving ? 'resolved' : 'open' } };
      }
      if (action === 'update') {
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (values.status !== undefined) update.status = text(values.status, 20);
        if (values.priority !== undefined) update.priority = text(values.priority, 20);
        if (values.category_key !== undefined) update.category_key = await requireCategory(db, values.category_key);
        if (values.assigned_to !== undefined) update.assigned_to = values.assigned_to || null;
        const { error } = await db.from('support_tickets').update(update).eq('id', ticketId);
        if (error) throw new ApiError(500, 'Could not update the ticket.');
        await audit(session, request, 'admin.ticket.updated', 'support_ticket', ticketId, { before: snapshot(ticket, ['status', 'priority', 'assigned_to']), after: update }, String(ticket.organization_id));
        return { data: { updated: true } };
      }
      if (action === 'delete') {
        const { error } = await db.from('support_tickets').delete().eq('id', ticketId);
        if (error) throw new ApiError(500, 'Could not delete the ticket.');
        await audit(session, request, 'admin.ticket.deleted', 'support_ticket', ticketId, { subject: ticket.subject }, String(ticket.organization_id));
        return { data: { deleted: true } };
      }
      throw new ApiError(405, 'Unsupported ticket action.');
    }

    case 'announcements': {
      if (action === 'create' || action === 'update') {
        const payload: Record<string, unknown> = {
          title: text(values.title, 200),
          body: text(values.body, 5000),
          variant: ['info', 'warning', 'success'].includes(String(values.variant)) ? values.variant : 'info',
          is_active: values.is_active === undefined ? true : bool(values.is_active),
          updated_at: new Date().toISOString(),
        };
        if (!payload.title || !payload.body) throw new ApiError(422, 'Provide a title and announcement body.');
        if (values.starts_at) payload.starts_at = values.starts_at;
        if (values.ends_at !== undefined) payload.ends_at = values.ends_at || null;
        if (action === 'create') payload.created_by = session.userId;
        const query = action === 'create'
          ? db.from('announcements').insert(payload)
          : db.from('announcements').update(payload).eq('id', requireId(body));
        const { data, error } = await query.select('id').single();
        if (error || !data) throw new ApiError(500, 'Could not save the announcement.');
        await audit(session, request, `admin.announcement.${action === 'create' ? 'created' : 'updated'}`, 'announcement', String(data.id), { title: payload.title });
        return { data: { id: data.id } };
      }
      const announcementId = id ?? '';
      if (!announcementId) throw new ApiError(422, 'Missing announcement id.');
      if (action === 'activate' || action === 'deactivate') {
        const { error } = await db.from('announcements').update({ is_active: action === 'activate', updated_at: new Date().toISOString() }).eq('id', announcementId);
        if (error) throw new ApiError(500, 'Could not update the announcement.');
        await audit(session, request, `admin.announcement.${action}`, 'announcement', announcementId);
        return { data: { active: action === 'activate' } };
      }
      if (action === 'delete') {
        const { error } = await db.from('announcements').delete().eq('id', announcementId);
        if (error) throw new ApiError(500, 'Could not delete the announcement.');
        await audit(session, request, 'admin.announcement.deleted', 'announcement', announcementId);
        return { data: { deleted: true } };
      }
      throw new ApiError(405, 'Unsupported announcement action.');
    }

    case 'feature-flags': {
      if (action === 'create') {
        const key = text(values.key, 80);
        if (!key) throw new ApiError(422, 'Enter a flag key.');
        const { error } = await db.from('feature_flags').upsert({
          key,
          description: text(values.description, 300),
          enabled: bool(values.enabled),
          rollout: jsonValue(values.rollout, {}),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
        if (error) throw new ApiError(500, 'Could not create the feature flag.');
        await audit(session, request, 'admin.feature_flag.created', 'feature_flag', key, { enabled: bool(values.enabled) });
        return { data: { key } };
      }
      const flagKey = id ?? text(values.key, 80) ?? '';
      if (!flagKey) throw new ApiError(422, 'Missing feature flag key.');
      if (action === 'update') {
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (values.enabled !== undefined) update.enabled = bool(values.enabled);
        if (values.description !== undefined) update.description = text(values.description, 300);
        if (values.rollout !== undefined) update.rollout = jsonValue(values.rollout, {});
        const { error } = await db.from('feature_flags').update(update).eq('key', flagKey);
        if (error) throw new ApiError(500, 'Could not update the feature flag.');
        await audit(session, request, 'admin.feature_flag.updated', 'feature_flag', flagKey, update);
        return { data: { updated: true } };
      }
      if (action === 'delete') {
        const { error } = await db.from('feature_flags').delete().eq('key', flagKey);
        if (error) throw new ApiError(500, 'Could not delete the feature flag.');
        await audit(session, request, 'admin.feature_flag.deleted', 'feature_flag', flagKey);
        return { data: { deleted: true } };
      }
      throw new ApiError(405, 'Unsupported feature flag action.');
    }

    case 'settings': {
      if (action === 'create' || action === 'update') {
        const key = text(values.key, 100) ?? id;
        if (!key) throw new ApiError(422, 'Enter a setting key.');
        const { error } = await db.from('system_settings').upsert({
          key,
          value: jsonValue(values.value, {}),
          is_public: bool(values.is_public),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });
        if (error) throw new ApiError(500, 'Could not save the setting.');
        await audit(session, request, 'admin.setting.updated', 'system_setting', key, { is_public: bool(values.is_public) });
        return { data: { key } };
      }
      const settingKey = id ?? '';
      if (!settingKey) throw new ApiError(422, 'Missing setting key.');
      if (action === 'delete') {
        const { error } = await db.from('system_settings').delete().eq('key', settingKey);
        if (error) throw new ApiError(500, 'Could not delete the setting.');
        await audit(session, request, 'admin.setting.deleted', 'system_setting', settingKey);
        return { data: { deleted: true } };
      }
      throw new ApiError(405, 'Unsupported setting action.');
    }

    case 'jobs': {
      const jobIds = ids.length ? ids : id ? [id] : [];
      if (!jobIds.length) throw new ApiError(422, 'Missing job id.');
      if (action === 'retry') {
        const { error } = await db.from('background_jobs').update({ status: 'queued', attempts: 0, run_at: new Date().toISOString(), last_error: null, locked_at: null, locked_by: null, updated_at: new Date().toISOString() }).in('id', jobIds);
        if (error) throw new ApiError(500, 'Could not retry the job.');
        await audit(session, request, 'admin.job.retried', 'background_job', jobIds.join(','), { count: jobIds.length });
        return { data: { retried: jobIds.length } };
      }
      if (action === 'cancel') {
        const { error } = await db.from('background_jobs').update({ status: 'cancelled', updated_at: new Date().toISOString() }).in('id', jobIds);
        if (error) throw new ApiError(500, 'Could not cancel the job.');
        await audit(session, request, 'admin.job.cancelled', 'background_job', jobIds.join(','), { count: jobIds.length });
        return { data: { cancelled: jobIds.length } };
      }
      if (action === 'delete') {
        const { error } = await db.from('background_jobs').delete().in('id', jobIds);
        if (error) throw new ApiError(500, 'Could not delete the job.');
        await audit(session, request, 'admin.job.deleted', 'background_job', jobIds.join(','), { count: jobIds.length });
        return { data: { deleted: jobIds.length } };
      }
      throw new ApiError(405, 'Unsupported job action.');
    }

    case 'errors': {
      const errorIds = ids.length ? ids : id ? [id] : [];
      if (!errorIds.length) throw new ApiError(422, 'Missing error id.');
      if (action === 'resolve' || action === 'reopen_error') {
        const { error } = await db.from('error_logs').update({ resolved_at: action === 'resolve' ? new Date().toISOString() : null }).in('id', errorIds);
        if (error) throw new ApiError(500, 'Could not update the error log.');
        await audit(session, request, `admin.error.${action === 'resolve' ? 'resolved' : 'reopened'}`, 'error_log', errorIds.join(','), { count: errorIds.length });
        return { data: { updated: errorIds.length } };
      }
      if (action === 'delete') {
        const { error } = await db.from('error_logs').delete().in('id', errorIds);
        if (error) throw new ApiError(500, 'Could not delete the error log.');
        await audit(session, request, 'admin.error.deleted', 'error_log', errorIds.join(','), { count: errorIds.length });
        return { data: { deleted: errorIds.length } };
      }
      throw new ApiError(405, 'Unsupported error action.');
    }

    case 'webhooks': {
      const webhookIds = ids.length ? ids : id ? [id] : [];
      if (!webhookIds.length) throw new ApiError(422, 'Missing webhook id.');
      if (action === 'mark_processed') {
        const { error } = await db.from('webhook_events').update({ processed_at: new Date().toISOString(), error: null }).in('id', webhookIds);
        if (error) throw new ApiError(500, 'Could not mark the webhook processed.');
        await audit(session, request, 'admin.webhook.processed', 'webhook_event', webhookIds.join(','), { count: webhookIds.length });
        return { data: { processed: webhookIds.length } };
      }
      if (action === 'delete') {
        const { error } = await db.from('webhook_events').delete().in('id', webhookIds);
        if (error) throw new ApiError(500, 'Could not delete the webhook event.');
        await audit(session, request, 'admin.webhook.deleted', 'webhook_event', webhookIds.join(','), { count: webhookIds.length });
        return { data: { deleted: webhookIds.length } };
      }
      throw new ApiError(405, 'Unsupported webhook action.');
    }

    case 'roles': {
      if (action === 'create_role' || action === 'update_role') {
        const key = text(values.key, 60) ?? id;
        const name = text(values.name, 80);
        if (!key || !name) throw new ApiError(422, 'A role key and name are required.');
        if (key === 'super_admin' && Array.isArray(values.permissions) && !values.permissions.includes('*')) {
          throw new ApiError(409, 'The super admin role must keep full permissions.');
        }
        const permissions = Array.isArray(values.permissions) ? values.permissions.map(String).slice(0, 200) : ['*'];
        const { error } = await db.from('admin_roles').upsert({ key, name, permissions }, { onConflict: 'key' });
        if (error) throw new ApiError(500, 'Could not save the role.');
        await audit(session, request, `admin.role.${action === 'create_role' ? 'created' : 'updated'}`, 'admin_role', key, { name, permissions });
        return { data: { key } };
      }
      if (action === 'delete_role') {
        const roleKey = id ?? '';
        if (!roleKey) throw new ApiError(422, 'Missing role key.');
        if (roleKey === 'super_admin') throw new ApiError(409, 'The super admin role cannot be deleted.');
        const { count } = await db.from('platform_admins').select('user_id', { count: 'exact', head: true }).eq('role', roleKey);
        if ((count ?? 0) > 0) throw new ApiError(409, 'This role is assigned to an administrator.', 'role_in_use');
        const { error } = await db.from('admin_roles').delete().eq('key', roleKey);
        if (error) throw new ApiError(500, 'Could not delete the role.');
        await audit(session, request, 'admin.role.deleted', 'admin_role', roleKey);
        return { data: { deleted: true } };
      }
      if (action === 'assign' || action === 'update_admin') {
        const email = text(values.email, 254);
        const roleKey = text(values.role, 60);
        if (!roleKey) throw new ApiError(422, 'Choose an admin role.');
        const { data: role } = await db.from('admin_roles').select('key').eq('key', roleKey).maybeSingle();
        if (!role) throw new ApiError(422, 'Unknown admin role.');
        let userId = text(values.user_id, 100);
        if (!userId) {
          if (!email) throw new ApiError(422, 'Enter the email of a registered user.');
          const found = await findUserByEmail(db, email);
          if (!found) throw new ApiError(404, 'No registered user has that email address.', 'user_not_found');
          userId = found.id;
        }
        const { error } = await db.from('platform_admins').upsert({
          user_id: userId,
          role: roleKey,
          granted_by: session.userId,
          notes: text(values.notes, 500),
        }, { onConflict: 'user_id' });
        if (error) throw new ApiError(500, `Could not assign the role: ${error.message}`);
        await audit(session, request, `admin.admin.${action === 'assign' ? 'granted' : 'updated'}`, 'platform_admin', userId, { role: roleKey, email });
        return { data: { user_id: userId, role: roleKey } };
      }
      if (action === 'remove_admin') {
        const userId = id ?? '';
        if (!userId) throw new ApiError(422, 'Missing administrator id.');
        await ensureNotSelf(session, userId, 'remove');
        await ensureAnotherSuperAdmin(db, userId);
        const { error } = await db.from('platform_admins').delete().eq('user_id', userId);
        if (error) throw new ApiError(500, 'Could not remove the administrator.');
        await audit(session, request, 'admin.admin.removed', 'platform_admin', userId);
        return { data: { removed: true } };
      }
      throw new ApiError(405, 'Unsupported role action.');
    }

    default:
      throw new ApiError(405, `${module} is read-only.`);
  }
}
