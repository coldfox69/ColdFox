import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

const LEAD_TAG_CHUNK = 500;

export async function syncLeadTags(db: SupabaseClient, organizationId: string, leadId: string, tags: string[]) {
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
  await db.from('lead_tag_assignments').delete().eq('organization_id', organizationId).eq('lead_id', leadId);
  if (!clean.length) return;
  await db.from('lead_tags').upsert(
    clean.map((name) => ({ organization_id: organizationId, name })),
    { onConflict: 'organization_id,name', ignoreDuplicates: true },
  );
  const { data: tagRows } = await db.from('lead_tags').select('id, name').eq('organization_id', organizationId).in('name', clean);
  if (tagRows?.length) {
    await db.from('lead_tag_assignments').upsert(
      tagRows.map((tag) => ({ organization_id: organizationId, lead_id: leadId, tag_id: tag.id })),
      { onConflict: 'lead_id,tag_id', ignoreDuplicates: true },
    );
  }
}

/**
 * Bulk version of `syncLeadTags` for import paths.
 *
 * Resolves the tags of a whole batch at once instead of once per lead: a
 * single upsert for the union of every tag name, a single read that turns
 * those names into ids, and a single upsert for every (lead, tag) pair.
 * Existing assignments are left untouched - the import creates brand new
 * leads, so there is nothing to delete.
 */
export async function syncLeadTagsBulk(db: SupabaseClient, organizationId: string, assignments: Map<string, string[]>) {
  if (!assignments.size) return;

  const perLead = new Map<string, string[]>();
  const union = new Set<string>();
  for (const [leadId, tags] of assignments) {
    const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 20);
    if (!clean.length) continue;
    perLead.set(leadId, clean);
    for (const name of clean) union.add(name);
  }
  if (!union.size) return;

  const names = [...union];

  // 1. Create every tag of the union in as few statements as possible.
  for (let i = 0; i < names.length; i += LEAD_TAG_CHUNK) {
    const batch = names.slice(i, i + LEAD_TAG_CHUNK);
    const { error } = await db
      .from('lead_tags')
      .upsert(batch.map((name) => ({ organization_id: organizationId, name })), { onConflict: 'organization_id,name', ignoreDuplicates: true });
    if (error) {
      // A single malformed name must not poison the whole batch, so retry the
      // failed chunk one name at a time and keep the names that are valid.
      for (const name of batch) {
        await db.from('lead_tags').upsert([{ organization_id: organizationId, name }], { onConflict: 'organization_id,name', ignoreDuplicates: true });
      }
    }
  }

  // 2. Resolve the union to tag ids.
  const tagIdByName = new Map<string, string>();
  for (let i = 0; i < names.length; i += LEAD_TAG_CHUNK) {
    const batch = names.slice(i, i + LEAD_TAG_CHUNK);
    const { data: tagRows } = await db.from('lead_tags').select('id, name').eq('organization_id', organizationId).in('name', batch);
    for (const row of tagRows ?? []) {
      const name = String(row.name);
      if (!tagIdByName.has(name)) tagIdByName.set(name, String(row.id));
    }
  }
  if (!tagIdByName.size) return;

  // 3. Link every lead to its tags.
  const rows: { organization_id: string; lead_id: string; tag_id: string }[] = [];
  for (const [leadId, tags] of perLead) {
    for (const name of tags) {
      const tagId = tagIdByName.get(name);
      if (!tagId) continue;
      rows.push({ organization_id: organizationId, lead_id: leadId, tag_id: tagId });
    }
  }
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += LEAD_TAG_CHUNK) {
    await db
      .from('lead_tag_assignments')
      .upsert(rows.slice(i, i + LEAD_TAG_CHUNK), { onConflict: 'lead_id,tag_id', ignoreDuplicates: true });
  }
}

export async function tagsForLeads(db: SupabaseClient, organizationId: string, leadIds: string[]) {
  if (!leadIds.length) return new Map<string, string[]>();
  const { data } = await db
    .from('lead_tag_assignments')
    .select('lead_id, tag:lead_tags(name)')
    .eq('organization_id', organizationId)
    .in('lead_id', leadIds);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const name = (row.tag as unknown as { name: string } | null)?.name;
    if (!name) continue;
    const list = map.get(row.lead_id as string) ?? [];
    list.push(name);
    map.set(row.lead_id as string, list);
  }
  return map;
}

export async function recordLeadActivity(
  db: SupabaseClient,
  input: { organizationId: string; leadId: string; actorId?: string | null; type: string; description?: string; metadata?: Record<string, unknown> },
) {
  await db.from('lead_activities').insert({
    organization_id: input.organizationId,
    lead_id: input.leadId,
    actor_id: input.actorId ?? null,
    activity_type: input.type,
    description: input.description ?? null,
    metadata: input.metadata ?? {},
  });
}

export function toLeadDto(row: Record<string, unknown>, tags: string[] = []) {
  return {
    id: row.id,
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    email: row.email,
    company: row.company_name ?? '',
    companyName: row.company_name ?? '',
    jobTitle: row.job_title ?? '',
    phone: row.phone ?? '',
    website: row.website ?? '',
    industry: row.industry ?? '',
    city: row.city ?? '',
    country: row.country ?? '',
    linkedinUrl: row.linkedin_url ?? '',
    status: row.status,
    source: row.source,
    tags,
    customData: row.custom_data ?? {},
    notes: row.notes ?? null,
    lastContacted: row.last_contacted_at ?? null,
    nextFollowUp: row.next_follow_up_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
