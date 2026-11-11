/** Template rendering shared by the UI, the send engine and tests.
 *  Deliberately not a general-purpose template language: only {{variables}} are replaced. */

export const STANDARD_VARIABLES = [
  'first_name', 'last_name', 'company', 'job_title', 'website', 'industry',
  'sender_name', 'sender_company', 'email', 'city', 'country',
] as const;

export type TemplateVars = Record<string, string | null | undefined>;

const VARIABLE_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

export function extractVariables(...templates: string[]): string[] {
  const found = new Set<string>();
  for (const template of templates) {
    for (const match of template.matchAll(VARIABLE_RE)) found.add(match[1]);
  }
  return [...found].sort();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain-text rendering: never inject HTML here. */
export function renderText(template: string, vars: TemplateVars): string {
  return template.replace(VARIABLE_RE, (whole, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? whole : String(value);
  });
}

export function renderHtml(template: string, vars: TemplateVars): string {
  return template.replace(VARIABLE_RE, (whole, key: string) => {
    const value = vars[key];
    return value === null || value === undefined ? whole : escapeHtml(String(value));
  });
}

export function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
  return paragraphs || '<p></p>';
}

export interface VariableIssue {
  variable: string;
  required: boolean;
  missing: boolean;
}

export function validateVariables(templates: string[], vars: TemplateVars, required: string[] = []): VariableIssue[] {
  const used = extractVariables(...templates);
  return used.map((variable) => {
    const value = vars[variable];
    return {
      variable,
      required: required.includes(variable),
      missing: value === null || value === undefined || String(value).trim() === '',
    };
  });
}

export function buildLeadVariables(lead: Record<string, unknown> | null | undefined): TemplateVars {
  if (!lead) return {};
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    first_name: str(lead.first_name),
    last_name: str(lead.last_name),
    email: str(lead.email),
    company: str(lead.company_name),
    company_name: str(lead.company_name),
    job_title: str(lead.job_title),
    website: str(lead.website),
    industry: str(lead.industry),
    city: str(lead.city),
    country: str(lead.country),
    ...(typeof lead.custom_data === 'object' && lead.custom_data ? (lead.custom_data as TemplateVars) : {}),
  };
}

export function applyUnsubscribeFooter(text: string, html: string, unsubscribeUrl: string) {
  const plainFooter = `\n\n---\nYou are receiving this email because we believe it may be relevant to your work.\nUnsubscribe: ${unsubscribeUrl}`;
  const htmlFooter = `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" /><p style="font-size:12px;color:#64748b">You are receiving this email because we believe it may be relevant to your work.<br /><a href="${escapeHtml(unsubscribeUrl)}" style="color:#2563eb">Unsubscribe</a></p>`;
  return { text: text + plainFooter, html: html + htmlFooter };
}
