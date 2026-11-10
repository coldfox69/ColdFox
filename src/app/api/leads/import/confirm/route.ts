import { z } from 'zod';
import { withApi, ok, requireApiSession, enforceRateLimit, ApiError, assertRole, writeAudit } from '@/lib/http';
import { parseSpreadsheet } from '@/lib/import/spreadsheet';
import { createServiceClient } from '@/lib/supabase/service';
import { CRM_FIELDS } from '@/lib/ai/columns';
import { syncLeadTagsBulk } from '@/lib/leads';

export const runtime = 'nodejs';
export const maxDuration = 60;

const mappingSchema = z.array(
  z.object({
    header: z.string().max(200),
    field: z.enum(CRM_FIELDS),
  }),
).min(1).max(60);

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text.slice(0, 300);
}

export async function POST(request: Request) {
  return withApi({ route: '/api/leads/import/confirm', method: 'POST' }, async () => {
    const session = await requireApiSession();
    assertRole(session, ['owner', 'admin', 'member']);
    await enforceRateLimit(request, 'lead-import-confirm', 10, 3600, session.userId);

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    const mappingRaw = form?.get('mapping');
    if (!(file instanceof File)) throw new ApiError(422, 'The file was not included.');
    if (typeof mappingRaw !== 'string') throw new ApiError(422, 'Confirm a column mapping before importing.');

    let mapping: { header: string; field: string }[];
    try {
      mapping = mappingSchema.parse(JSON.parse(mappingRaw));
    } catch {
      throw new ApiError(422, 'The column mapping is invalid.');
    }

    const parsed = await parseSpreadsheet(file);
    const headerIndex = new Map(parsed.headers.map((h, i) => [h, i]));
    const fields = new Map(mapping.filter((m) => headerIndex.has(m.header)).map((m) => [m.field, headerIndex.get(m.header)!]));
    const emailIdx = fields.get('email');
    if (emailIdx === undefined) throw new ApiError(422, 'Map one column to Email before importing.');

    const db = createServiceClient();
    const { data: existing } = await db
      .from('leads')
      .select('email_normalized')
      .eq('organization_id', session.organizationId)
      .is('deleted_at', null)
      .limit(50000);
    const seen = new Set((existing ?? []).map((r) => String(r.email_normalized)));

    const { data: limit } = await db.rpc('plan_limit', { p_org: session.organizationId, p_metric: 'leads' });
    const { data: used } = await db.rpc('org_usage', { p_org: session.organizationId, p_metric: 'leads' });
    const remaining = limit === null || limit === undefined || Number(limit) === -1 ? Number.POSITIVE_INFINITY : Math.max(0, Number(limit) - Number(used ?? 0));

    const candidates: Record<string, unknown>[] = [];
    const invalid: string[] = [];
    let duplicates = 0;

    for (const row of parsed.rows) {
      const email = String(row[emailIdx] ?? '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        if (email) invalid.push(email.slice(0, 120));
        continue;
      }
      if (seen.has(email)) { duplicates += 1; continue; }
      seen.add(email);
      if (candidates.length >= remaining) break;

      const value = (field: string) => {
        const idx = fields.get(field);
        return idx === undefined ? null : clean(row[idx]);
      };
      candidates.push({
        organization_id: session.organizationId,
        first_name: value('first_name'),
        last_name: value('last_name'),
        email,
        company_name: value('company'),
        job_title: value('job_title'),
        website: value('website'),
        industry: value('industry'),
        phone: value('phone'),
        linkedin_url: value('linkedin_url'),
        city: value('city'),
        country: value('country'),
        source: 'import',
        status: 'new',
        created_by: session.userId,
        owner_id: session.userId,
      });
    }

    if (!candidates.length) {
      return ok({ created: 0, duplicates, invalid: invalid.length, sampleInvalid: invalid.slice(0, 10), limited: false, totalRows: parsed.rows.length, leadIds: [] });
    }

    const createdIds: string[] = [];
    const leadEmailById = new Map<string, string>();
    for (let i = 0; i < candidates.length; i += 400) {
      const chunk = candidates.slice(i, i + 400);
      const { data, error } = await db.from('leads').insert(chunk).select('id, email_normalized');
      if (!error && data) {
        for (const row of data) {
          const id = row.id as string;
          createdIds.push(id);
          leadEmailById.set(id, String(row.email_normalized));
        }
        continue;
      }
      // Retry the chunk as one bulk insert and read the ids back afterwards.
      const bulk = await db.from('leads').insert(chunk);
      if (!bulk.error) {
        const emails = chunk.map((row) => String(row.email));
        for (let j = 0; j < emails.length; j += 100) {
          const { data: inserted } = await db
            .from('leads')
            .select('id, email_normalized')
            .eq('organization_id', session.organizationId)
            .is('deleted_at', null)
            .in('email_normalized', emails.slice(j, j + 100));
          for (const row of inserted ?? []) {
            const id = row.id as string;
            createdIds.push(id);
            leadEmailById.set(id, String(row.email_normalized));
          }
        }
        continue;
      }
      // A race or malformed row should not abort the whole import.
      for (const single of chunk) {
        const { data: one } = await db.from('leads').insert(single).select('id, email_normalized').maybeSingle();
        if (one) {
          const id = one.id as string;
          createdIds.push(id);
          leadEmailById.set(id, String(one.email_normalized));
        }
      }
    }

    // Preserve tags from any mapped custom columns labelled "tag".
    const tagIdx = parsed.headers.findIndex((h) => /^tags?$/i.test(h));
    if (tagIdx >= 0 && createdIds.length) {
      const tagByEmail = new Map<string, string[]>();
      for (const row of parsed.rows) {
        const email = String(row[emailIdx] ?? '').trim().toLowerCase();
        const raw = String(row[tagIdx] ?? '').trim();
        if (email && raw) tagByEmail.set(email, raw.split(/[;,|]/).map((t) => t.trim()).filter(Boolean).slice(0, 10));
      }
      const assignments = new Map<string, string[]>();
      for (const [leadId, email] of leadEmailById) {
        const tags = tagByEmail.get(email);
        if (tags?.length) assignments.set(leadId, tags);
      }
      await syncLeadTagsBulk(db, session.organizationId, assignments);
    }

    if (createdIds.length) {
      await db.rpc('record_usage', { p_org: session.organizationId, p_metric: 'leads', p_quantity: createdIds.length }).then(() => undefined, () => undefined);
    }
    await writeAudit({
      organizationId: session.organizationId,
      actorId: session.userId,
      actorEmail: session.email,
      action: 'leads.imported',
      entityType: 'lead',
      request,
      metadata: { created: createdIds.length, duplicates, invalid: invalid.length, filename: parsed.filename },
    });

    return ok({
      created: createdIds.length,
      duplicates,
      invalid: invalid.length,
      sampleInvalid: invalid.slice(0, 10),
      limited: Number.isFinite(remaining) && candidates.length >= remaining,
      totalRows: parsed.rows.length,
      leadIds: createdIds,
    });
  });
}
