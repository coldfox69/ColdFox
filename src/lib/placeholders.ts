/**
 * Dynamic personalization placeholders.
 *
 * Lead lists store their own column metadata, so the set of available
 * placeholders is derived from the actual spreadsheet the user uploaded,
 * not from a fixed catalog. This module is the single source of truth for
 * naming, normalising, deduplicating, rendering and validating those
 * placeholders. It is intentionally free of server/client dependencies so
 * both the UI and the send engine share it.
 */

export interface LeadListColumn {
  /** Stable key used inside {{placeholders}}, e.g. `first_name`. */
  key: string;
  /** Placeholder text including braces, e.g. `{{first_name}}`. */
  placeholder: string;
  /** Human label, e.g. "Job title". */
  label: string;
  /** Original header from the spreadsheet. */
  original: string;
  /** Short description of what this field usually contains. */
  description: string;
  /** An example value from the imported file (trimmed). */
  example: string;
  /** Whether this column was mapped to a known CRM field. */
  mapped: boolean;
  /** CRM field key if mapped (e.g. first_name), otherwise custom. */
  mappedField: string | null;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
const DIACRITICS_RE = /[\u0300-\u036f]/g;
const STANDARD_LABELS: Record<string, { label: string; description: string }> = {
  first_name: { label: 'First name', description: "The recipient's given name." },
  last_name: { label: 'Last name', description: "The recipient's family name." },
  email: { label: 'Email', description: "The recipient's email address." },
  company: { label: 'Company', description: "The recipient's company or organization." },
  company_name: { label: 'Company', description: "The recipient's company or organization." },
  job_title: { label: 'Job title', description: "The recipient's role at their company." },
  website: { label: 'Website', description: "The recipient's company website or domain." },
  industry: { label: 'Industry', description: "The industry or sector of the recipient's company." },
  phone: { label: 'Phone', description: "The recipient's phone number." },
  linkedin_url: { label: 'LinkedIn', description: "The recipient's LinkedIn profile URL." },
  city: { label: 'City', description: 'The city where the recipient is based.' },
  country: { label: 'Country', description: 'The country where the recipient is based.' },
  location: { label: 'Location', description: "The recipient's location." },
  sender_name: { label: 'Sender name', description: 'Your display name (added automatically).' },
  sender_company: { label: 'Sender company', description: 'Your workspace name (added automatically).' },
};

/** Normalise a raw spreadsheet header into a stable snake_case key. */
export function normalizeColumnKey(raw: string): string {
  const ascii = raw
    .normalize('NFKD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return ascii || 'column';
}

export interface RawColumnInput {
  header: string;
  samples: string[];
  mappedField?: string | null;
}

/**
 * Build the deduplicated placeholder list for an uploaded list.
 * Two columns that normalise to the same key are kept distinct by suffixing
 * (`_2`, `_3`) so no placeholder is ever suggested twice.
 */
export function buildLeadListColumns(inputs: RawColumnInput[]): LeadListColumn[] {
  const out: LeadListColumn[] = [];
  const used = new Map<string, number>();
  for (const input of inputs) {
    const original = String(input.header ?? '').trim();
    if (!original) continue;
    const base = normalizeColumnKey(original);
    const seen = used.get(base) ?? 0;
    const key = seen === 0 ? base : `${base}_${seen + 1}`;
    used.set(base, seen + 1);
    const mappedField = input.mappedField ?? null;
    const meta = STANDARD_LABELS[key] ?? STANDARD_LABELS[mappedField ?? ''] ?? null;
    const example = (input.samples.find((s) => String(s).trim() !== '') ?? '').slice(0, 120);
    out.push({
      key,
      placeholder: `{{${key}}}`,
      label: meta?.label ?? toLabel(original),
      original,
      description: meta?.description ?? `Value from the "${original}" column.`,
      example,
      mapped: Boolean(mappedField),
      mappedField,
    });
  }
  return out;
}

export function toLabel(raw: string): string {
  const cleaned = raw.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Unique placeholders across a set of columns, order preserved. */
export function leadListPlaceholders(columns: LeadListColumn[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const column of columns) {
    if (!seen.has(column.key)) {
      seen.add(column.key);
      out.push(column.placeholder);
    }
  }
  return out;
}

export function extractRawVariables(...templates: string[]): string[] {
  const found = new Set<string>();
  for (const template of templates) {
    for (const match of template.matchAll(PLACEHOLDER_RE)) found.add(match[1]);
  }
  return [...found].sort();
}

/** Find `{{placeholders}}` that remain after rendering. */
export function findUnresolvedPlaceholders(...rendered: string[]): string[] {
  const found = new Set<string>();
  for (const text of rendered) {
    for (const match of text.matchAll(PLACEHOLDER_RE)) found.add(match[1]);
  }
  return [...found].sort();
}

export interface PlaceholderCheck {
  key: string;
  supported: boolean;
  example?: string;
}

/**
 * Validate the variables used by a template against the columns of the
 * lead list a campaign will use. Unknown variables are reported; the caller
 * decides whether to block or warn.
 */
export function validateVariablesAgainstList(
  used: string[],
  columns: LeadListColumn[],
): PlaceholderCheck[] {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const byMapped = new Map(columns.filter((c) => c.mappedField).map((c) => [String(c.mappedField), c]));
  return used.map((key) => {
    const direct = byKey.get(key);
    if (direct) return { key, supported: true, example: direct.example };
    const viaMapped = byMapped.get(key) ?? byMapped.get(key === 'company_name' ? 'company' : key);
    if (viaMapped) return { key, supported: true, example: viaMapped.example };
    // Always-available engine-provided variables.
    if (key === 'sender_name' || key === 'sender_company') return { key, supported: true };
    return { key, supported: false };
  });
}

export interface RenderResult {
  text: string;
  missing: string[];
}

/**
 * Replace {{placeholders}} with actual values.
 * Values are used verbatim (plain text context, never HTML). Missing values
 * are reported; they never render as "undefined" or "null".
 * An optional per-key fallback is applied when the value is empty.
 */
export function renderPlaceholders(
  template: string,
  values: Record<string, string | null | undefined>,
  fallbacks: Record<string, string> = {},
): RenderResult {
  const missing: string[] = [];
  const text = template.replace(PLACEHOLDER_RE, (whole, rawKey: string) => {
    const key = rawKey.trim();
    const aliased = key === 'company' ? values.company_name
      : key === 'company_name' ? values.company ?? values.company_name
        : undefined;
    const raw = values[key] ?? aliased;
    const cleaned = raw === null || raw === undefined ? '' : String(raw).trim();
    if (cleaned) return cleaned;
    const fallback = fallbacks[key];
    if (fallback !== undefined) return fallback;
    missing.push(key);
    return whole;
  });
  return { text, missing: [...new Set(missing)] };
}
