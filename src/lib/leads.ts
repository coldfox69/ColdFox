import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

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
