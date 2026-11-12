/**
 * Importing leads into a lead list.
 *
 * Leads always arrive through a lead list. This module is the single
 * implementation of that rule, shared by the spreadsheet upload in
 * `/api/leads/import/confirm` and by the AI agent pipeline, so a lead created
 * by an agent is stored exactly like an uploaded one.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '@/lib/http';
import { syncLeadTagsBulk } from '@/lib/leads';
import { buildLeadListColumns, type LeadListColumn, type RawColumnInput } from '@/lib/placeholders';

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export type LeadListSource = 'import' | 'manual' | 'copy_paste' | 'agent';

export interface LeadColumnMapping {
  header: string;
  /** A CRM field, or 'custom' to keep the column as a personalization field. */
  field: string;
}

export interface ImportLeadRowsInput {
  db: SupabaseClient;
  organizationId: string;
  userId: string;
  listName: string;
  filename: string;
  headers: string[];
  rows: (string | number | null)[][];
  mapping: LeadColumnMapping[];
  source?: LeadListSource;
}

export interface ImportLeadRowsResult {
  created: number;
  duplicates: number;
  invalid: number;
  sampleInvalid: string[];
  limited: boolean;
  totalRows: number;
  leadIds: string[];
  leadListId: string;
  leadListName: string;
  columns: LeadListColumn[];
}

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text.slice(0, 300);
}

/**
 * Create a lead list and fill it with the given rows.
 * Duplicates of existing leads and rows without a valid email are skipped.
 */
export async function importLeadRows(input: ImportLeadRowsInput): Promise<ImportLeadRowsResult> {
  const { db, organizationId, userId } = input;
  const listName = input.listName.trim().slice(0, 160);
  if (listName.length < 2) throw new ApiError(422, 'Give the lead list a name before importing.');

  const headerIndex = new Map(input.headers.map((header, index) => [header, index]));
  const standardFields = new Map(
    input.mapping
      .filter((mapping) => headerIndex.has(mapping.header) && mapping.field !== 'custom' && mapping.field !== 'ignore')
      .map((mapping) => [mapping.field, headerIndex.get(mapping.header)!]),
  );
  const emailIdx = standardFields.get('email');
  if (emailIdx === undefined) throw new ApiError(422, 'Map one column to Email before importing.');

  // Build placeholder metadata from every kept column (custom + mapped).
  const mappingByHeader = new Map(input.mapping.map((mapping) => [mapping.header, mapping.field]));
  const columnInputs: RawColumnInput[] = input.headers.map((header, index) => {
    const field = mappingByHeader.get(header) ?? 'custom';
    const samples = [...new Set(input.rows.slice(0, 50).map((row) => clean(row[index])).filter((value): value is string => Boolean(value)))].slice(0, 8);
    return {
      header,
      samples,
      mappedField: field === 'custom' || field === 'ignore' ? null : field,
    };
  });
  const columns = buildLeadListColumns(columnInputs);

  const { data: existing } = await db
    .from('leads')
    .select('email_normalized')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .limit(50000);
  const seen = new Set((existing ?? []).map((row) => String(row.email_normalized)));

  const { data: limit } = await db.rpc('plan_limit', { p_org: organizationId, p_metric: 'leads' });
  const { data: used } = await db.rpc('org_usage', { p_org: organizationId, p_metric: 'leads' });
  const remaining = limit === null || limit === undefined || Number(limit) === -1
    ? Number.POSITIVE_INFINITY
    : Math.max(0, Number(limit) - Number(used ?? 0));

  const { data: leadList, error: listError } = await db
    .from('lead_lists')
    .insert({
      organization_id: organizationId,
      name: listName,
      filename: input.filename,
      columns,
      stats: { total_rows: input.rows.length, valid_rows: 0, invalid_rows: 0, duplicate_rows: 0 },
      source: input.source ?? 'import',
      created_by: userId,
    })
    .select('id')
    .single();
  if (listError || !leadList) throw new ApiError(500, 'Could not create the lead list.');
  const leadListId = leadList.id as string;

  const candidates: Record<string, unknown>[] = [];
  const invalid: string[] = [];
  let duplicates = 0;

  for (const row of input.rows) {
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
      organization_id: organizationId,
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
      source: input.source ?? 'import',
      status: 'new',
      created_by: userId,
      owner_id: userId,
      custom_data: customData,
    });
  }

  if (!candidates.length) {
    await db
      .from('lead_lists')
      .update({ stats: { total_rows: input.rows.length, valid_rows: 0, invalid_rows: invalid.length, duplicate_rows: duplicates } })
      .eq('id', leadListId);
    return {
      created: 0,
      duplicates,
      invalid: invalid.length,
      sampleInvalid: invalid.slice(0, 10),
      limited: false,
      totalRows: input.rows.length,
      leadIds: [],
      leadListId,
      leadListName: listName,
      columns,
    };
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
          .eq('organization_id', organizationId)
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

  const tagIdx = input.headers.findIndex((header) => /^tags?$/i.test(header));
  if (tagIdx >= 0 && createdIds.length) {
    const tagByEmail = new Map<string, string[]>();
    for (const row of input.rows) {
      const email = String(row[emailIdx] ?? '').trim().toLowerCase();
      const raw = String(row[tagIdx] ?? '').trim();
      if (email && raw) tagByEmail.set(email, raw.split(/[;,|]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 10));
    }
    const assignments = new Map<string, string[]>();
    for (const [leadId, email] of leadEmailById) {
      const tags = tagByEmail.get(email);
      if (tags?.length) assignments.set(leadId, tags);
    }
    await syncLeadTagsBulk(db, organizationId, assignments);
  }

  await db
    .from('lead_lists')
    .update({ stats: { total_rows: input.rows.length, valid_rows: createdIds.length, invalid_rows: invalid.length, duplicate_rows: duplicates } })
    .eq('id', leadListId);

  if (createdIds.length) {
    await db
      .rpc('record_usage', { p_org: organizationId, p_metric: 'leads', p_quantity: createdIds.length })
      .then(() => undefined, () => undefined);
  }

  return {
    created: createdIds.length,
    duplicates,
    invalid: invalid.length,
    sampleInvalid: invalid.slice(0, 10),
    limited: Number.isFinite(remaining) && candidates.length >= remaining,
    totalRows: input.rows.length,
    leadIds: createdIds,
    leadListId,
    leadListName: listName,
    columns,
  };
}
