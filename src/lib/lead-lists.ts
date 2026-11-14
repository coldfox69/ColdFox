import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeadListColumn } from '@/lib/placeholders';
import { leadListPlaceholders } from '@/lib/placeholders';
import { escapeCsvCell } from '@/lib/csv';

export interface LeadListDto {
  id: string;
  name: string;
  description: string | null;
  filename: string | null;
  source: string;
  stats: {
    total_rows?: number;
    valid_rows?: number;
    invalid_rows?: number;
    duplicate_rows?: number;
  };
  leadCount: number;
  placeholders: string[];
  placeholdersDetail: LeadListColumn[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export function toLeadListDto(row: Record<string, unknown>, leadCount: number): LeadListDto {
  const columns = Array.isArray(row.columns) ? (row.columns as LeadListColumn[]) : [];
  return {
    id: String(row.id),
    name: String(row.name),
    description: (row.description as string | null) ?? null,
    filename: (row.filename as string | null) ?? null,
    source: String(row.source ?? 'import'),
    stats: (row.stats as LeadListDto['stats']) ?? {},
    leadCount,
    placeholders: leadListPlaceholders(columns),
    placeholdersDetail: columns,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    archivedAt: (row.archived_at as string | null) ?? null,
  };
}

/** Load one list and validate it belongs to the org. */
export async function requireLeadList(db: SupabaseClient, organizationId: string, listId: string) {
  const { data, error } = await db
    .from('lead_lists')
    .select('*')
    .eq('id', listId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/** Find or create the workspace's default list for manually entered leads. */
export async function findOrCreateManualList(db: SupabaseClient, organizationId: string, userId?: string | null) {
  const { data: existing } = await db
    .from('lead_lists')
    .select('id')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .eq('source', 'manual')
    .ilike('name', 'Manual leads')
    .limit(1)
    .maybeSingle();
  if (existing?.id) return String(existing.id);
  const { data, error } = await db
    .from('lead_lists')
    .insert({
      organization_id: organizationId,
      name: 'Manual leads',
      description: 'Leads entered by hand or synced from manual sources.',
      source: 'manual',
      columns: [
        { key: 'first_name', placeholder: '{{first_name}}', label: 'First name', original: 'first_name', description: "The recipient's given name.", example: '', mapped: true, mappedField: 'first_name' },
        { key: 'last_name', placeholder: '{{last_name}}', label: 'Last name', original: 'last_name', description: "The recipient's family name.", example: '', mapped: true, mappedField: 'last_name' },
        { key: 'email', placeholder: '{{email}}', label: 'Email', original: 'email', description: "The recipient's email address.", example: '', mapped: true, mappedField: 'email' },
        { key: 'company_name', placeholder: '{{company_name}}', label: 'Company', original: 'company_name', description: "The recipient's company or organization.", example: '', mapped: true, mappedField: 'company' },
        { key: 'job_title', placeholder: '{{job_title}}', label: 'Job title', original: 'job_title', description: "The recipient's role at their company.", example: '', mapped: true, mappedField: 'job_title' },
        { key: 'website', placeholder: '{{website}}', label: 'Website', original: 'website', description: "The recipient's company website or domain.", example: '', mapped: true, mappedField: 'website' },
        { key: 'industry', placeholder: '{{industry}}', label: 'Industry', original: 'industry', description: "The industry or sector of the recipient's company.", example: '', mapped: true, mappedField: 'industry' },
        { key: 'city', placeholder: '{{city}}', label: 'City', original: 'city', description: 'The city where the recipient is based.', example: '', mapped: true, mappedField: 'city' },
        { key: 'country', placeholder: '{{country}}', label: 'Country', original: 'country', description: 'The country where the recipient is based.', example: '', mapped: true, mappedField: 'country' },
      ],
      stats: { total_rows: 0, valid_rows: 0, invalid_rows: 0, duplicate_rows: 0 },
      created_by: userId ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error('Could not create the manual leads list.');
  return String(data.id);
}

/** Count live leads in each of the given lists in one round trip. */
export async function leadCountsByList(db: SupabaseClient, organizationId: string, listIds: string[]) {
  const result = new Map<string, number>();
  if (!listIds.length) return result;
  // Supabase has no group-count aggregate, so fall back to one head count per
  // list. Typical workspaces have a handful of lists, so this stays cheap.
  const counts = await Promise.all(listIds.map((id) =>
    db.from('leads').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('lead_list_id', id).is('deleted_at', null),
  ));
  listIds.forEach((id, index) => result.set(id, Number(counts[index]?.count ?? 0)));
  return result;
}

/** Escape a value for a CSV cell (RFC 4180 quoting plus formula neutralisation). */
export function csvCell(value: unknown): string {
  return escapeCsvCell(value);
}

export function leadsToCsv(columns: LeadListColumn[], rows: Record<string, unknown>[]): string {
  const header = ['email', 'first_name', 'last_name', 'company_name', 'job_title', 'website', 'industry', 'status', ...columns.filter((c) => !['email', 'first_name', 'last_name', 'company', 'job_title', 'website', 'industry'].includes(c.key)).map((c) => c.key)];
  const lines = [header.join(',')];
  for (const row of rows) {
    const custom = (row.custom_data as Record<string, unknown>) ?? {};
    const cells = header.map((key) => {
      if (key in row && row[key] !== null && row[key] !== undefined) return csvCell(row[key]);
      if (key === 'company_name') return csvCell(custom.company_name ?? custom.company);
      return csvCell(custom[key]);
    });
    lines.push(cells.join(','));
  }
  return lines.join('\r\n');
}
