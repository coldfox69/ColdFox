import { z } from 'zod';
import { withApi, ok, requireApiSession, enforceRateLimit, ApiError, assertRole, writeAudit } from '@/lib/http';
import { parseSpreadsheet } from '@/lib/import/spreadsheet';
import { createServiceClient } from '@/lib/supabase/service';
import { CRM_FIELDS } from '@/lib/ai/columns';
import { syncLeadTagsBulk } from '@/lib/leads';
import { buildLeadListColumns, type RawColumnInput } from '@/lib/placeholders';

export const runtime = 'nodejs';
export const maxDuration = 60;

const mappingSchema = z.array(
  z.object({
    header: z.string().max(200),
    // A CRM field, or 'custom' to keep the column as a dynamic personalization field.
    field: z.union([z.enum(CRM_FIELDS), z.literal('custom')]),
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
    const leadListNameRaw = form?.get('lead_list_name');
    if (!(file instanceof File)) throw new ApiError(422, 'The file was not included.');
    if (typeof mappingRaw !== 'string') throw new ApiError(422, 'Confirm a column mapping before importing.');
    const leadListName = typeof leadListNameRaw === 'string' ? leadListNameRaw.trim().slice(0, 160) : '';
    if (leadListName.length < 2) throw new ApiError(422, 'Give the lead list a name before importing.');

    let mapping: { header: string; field: string }[];
    try {
      mapping = mappingSchema.parse(JSON.parse(mappingRaw));
    } catch {
      throw new ApiError(422, 'The column mapping is invalid.');
    }

    const parsed = await parseSpreadsheet(file);
    const headerIndex = new Map(parsed.headers.map((h, i) => [h, i]));
    // Only CRM-field mappings influence the standard columns; everything else is custom.
    const standardFields = new Map(
      mapping.filter((m) => headerIndex.has(m.header) && m.field !== 'custom' && m.field !== 'ignore').map((m) => [m.field, headerIndex.get(m.header)!]),
    );
    const emailIdx = standardFields.get('email');
    if (emailIdx === undefined) throw new ApiError(422, 'Map one column to Email before importing.');

    // Build placeholder metadata from every kept column (custom + mapped).
    const mappingByHeader = new Map(mapping.map((m) => [m.header, m.field]));
    const columnInputs: RawColumnInput[] = parsed.headers.map((header, index) => {
      const field = mappingByHeader.get(header) ?? 'custom';
      const samples = [...new Set(parsed.rows.slice(0, 50).map((row) => clean(row[index])).filter((v): v is string => Boolean(v)))].slice(0, 8);
      return {
        header,
        samples,
        mappedField: field === 'custom' ? null : field === 'ignore' ? null : field,
      };
    });
    const columns = buildLeadListColumns(columnInputs);

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

    // Create the lead list first so imported leads can reference it.
    const { data: leadList, error: listError } = await db
      .from('lead_lists')
      .insert({
        organization_id: session.organizationId,
        name: leadListName,
        filename: parsed.filename,
        columns,
        stats: { total_rows: parsed.rows.length, valid_rows: 0, invalid_rows: 0, duplicate_rows: 0 },
        source: 'import',
        created_by: session.userId,
      })
      .select('id')
      .single();
    if (listError || !leadList) throw new ApiError(500, 'Could not create the lead list.');
    const leadListId = leadList.id as string;

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
        const idx = standardFields.get(field);
        return idx === undefined ? null : clean(row[idx]);
      };
      // Custom data holds every imported column under its placeholder key.
      const customData: Record<string, unknown> = {};
      for (const column of columns) {
        const idx = headerIndex.get(column.original);
        if (idx === undefined || column.key === 'email') continue;
        const cell = clean(row[idx]);
        if (cell !== null) customData[column.key] = cell;
      }
      candidates.push({
        organization_id: session.organizationId,
        lead_list_id: leadListId,
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
        custom_data: customData,
      });
    }

    if (!candidates.length) {
      await db.from('lead_lists').update({ stats: { total_rows: parsed.rows.length, valid_rows: 0, invalid_rows: invalid.length, duplicate_rows: duplicates } }).eq('id', leadListId);
      return ok({ created: 0, duplicates, invalid: invalid.length, sampleInvalid: invalid.slice(0, 10), limited: false, totalRows: parsed.rows.length, leadIds: [], leadListId, leadListName });
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
      for (const single of chunk) {
        const { data: one } = await db.from('leads').insert(single).select('id, email_normalized').maybeSingle();
        if (one) {
          const id = one.id as string;
          createdIds.push(id);
          leadEmailById.set(id, String(one.email_normalized));
        }
      }
    }

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

    await db.from('lead_lists').update({
      stats: { total_rows: parsed.rows.length, valid_rows: createdIds.length, invalid_rows: invalid.length, duplicate_rows: duplicates },
    }).eq('id', leadListId);

    if (createdIds.length) {
      await db.rpc('record_usage', { p_org: session.organizationId, p_metric: 'leads', p_quantity: createdIds.length }).then(() => undefined, () => undefined);
    }
    await writeAudit({
      organizationId: session.organizationId,
      actorId: session.userId,
      actorEmail: session.email,
      action: 'leads.imported',
      entityType: 'lead_list',
      entityId: leadListId,
      request,
      metadata: { created: createdIds.length, duplicates, invalid: invalid.length, filename: parsed.filename, lead_list_name: leadListName },
    });

    return ok({
      created: createdIds.length,
      duplicates,
      invalid: invalid.length,
      sampleInvalid: invalid.slice(0, 10),
      limited: Number.isFinite(remaining) && candidates.length >= remaining,
      totalRows: parsed.rows.length,
      leadIds: createdIds,
      leadListId,
      leadListName,
      placeholders: columns.map((c) => c.placeholder),
    });
  });
}
