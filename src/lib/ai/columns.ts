import 'server-only';
import { z } from 'zod';
import { callGroqJson, recordAiUsage } from '@/lib/ai/groq';

export const CRM_FIELDS = [
  'first_name', 'last_name', 'email', 'company', 'job_title', 'website',
  'industry', 'phone', 'linkedin_url', 'city', 'country', 'ignore',
] as const;

export type CrmField = (typeof CRM_FIELDS)[number];

const aiColumnSchema = z.object({
  columns: z
    .array(
      z.object({
        name: z.string(),
        mapped_field: z.enum(CRM_FIELDS),
        confidence: z.number().min(0).max(1),
        ambiguous: z.boolean().default(false),
        reason: z.string().max(300).default(''),
        sample: z.string().max(120).optional(),
      }),
    )
    .max(60),
  missing_fields: z.array(z.string()).max(20).default([]),
  suggested_variables: z.array(z.string().max(60)).max(30).default([]),
  notes: z.array(z.string().max(400)).max(10).default([]),
});

export interface ColumnAnalysis {
  source: 'ai' | 'heuristic';
  columns: {
    name: string;
    mappedField: CrmField;
    confidence: number;
    ambiguous: boolean;
    reason: string;
    sample?: string;
  }[];
  missingFields: string[];
  suggestedVariables: string[];
  ambiguousColumns: string[];
  notes: string[];
  // Populated after analysis; detection is deterministic, not AI guesswork.
  detected: { emailColumn: string | null; totalRows: number; invalidEmailRows: number; duplicateRows: number; emptyRows: number };
}

const KEYWORDS: [RegExp, CrmField][] = [
  [/^(e-?mail|work e-?mail|email address|corporate e-?mail)$/i, 'email'],
  [/^(first ?name|given ?name|fname)$/i, 'first_name'],
  [/^(last ?name|surname|family ?name|lname)$/i, 'last_name'],
  [/^(full ?name|name|contact)$/i, 'first_name'],
  [/^(company|company ?name|organization|organisation|employer|account)$/i, 'company'],
  [/^(title|job ?title|position|role|designation)$/i, 'job_title'],
  [/^(website|domain|company website|url|homepage)$/i, 'website'],
  [/^(industry|sector|vertical)$/i, 'industry'],
  [/^(phone|mobile|telephone|tel|phone number)$/i, 'phone'],
  [/^(linkedin|linkedin url|linkedin profile)$/i, 'linkedin_url'],
  [/^(city|town|location)$/i, 'city'],
  [/^(country|region)$/i, 'country'],
];

export function heuristicMap(headers: string[], sampleRows: (string | number | null)[][]): ColumnAnalysis {
  const columns = headers.map((name, idx) => {
    const normalized = name.trim().replace(/[_-]+/g, ' ');
    const match = KEYWORDS.find(([re]) => re.test(normalized));
    const sample = sampleRows.map((r) => r[idx]).find((v) => v !== null && String(v).trim() !== '');
    let mappedField: CrmField = match?.[1] ?? 'ignore';
    let confidence = match ? 0.85 : 0.2;
    if (!match && sample && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(sample))) {
      mappedField = 'email';
      confidence = 0.75;
    }
    return {
      name,
      mappedField,
      confidence,
      ambiguous: !match && mappedField !== 'ignore',
      reason: match ? `Header matches "${normalized}".` : 'No clear header match; review this mapping.',
      sample: sample === undefined ? undefined : String(sample).slice(0, 60),
    };
  });

  return {
    source: 'heuristic',
    columns,
    missingFields: ['email', 'first_name', 'company'].filter((f) => !columns.some((c) => c.mappedField === f)),
    suggestedVariables: [...new Set(columns.filter((c) => c.mappedField !== 'ignore').map((c) => c.mappedField))],
    ambiguousColumns: columns.filter((c) => c.ambiguous).map((c) => c.name),
    notes: ['Mappings were inferred from header names and sample values. Confirm every field before importing.'],
    detected: detectRows(headers, sampleRows, columns.find((c) => c.mappedField === 'email')?.name ?? null),
  };
}

function detectRows(headers: string[], rows: (string | number | null)[][], emailHeader: string | null) {
  const idx = emailHeader ? headers.indexOf(emailHeader) : -1;
  let invalid = 0;
  let empty = 0;
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    if (row.every((v) => v === null || String(v).trim() === '')) { empty++; continue; }
    if (idx >= 0) {
      const email = String(row[idx] ?? '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) invalid++;
      else if (seen.has(email)) duplicates++;
      else seen.add(email);
    }
  }
  return { emailColumn: emailHeader, totalRows: rows.length, invalidEmailRows: invalid, duplicateRows: duplicates, emptyRows: empty };
}

function maskSamples(rows: (string | number | null)[][]): (string | number | null)[][] {
  return rows.map((row) =>
    row.map((value) => {
      if (value === null) return null;
      const s = String(value);
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
        const [local, domain] = s.split('@');
        return `${local.slice(0, 1)}***@${domain}`;
      }
      if (/^\+?[\d\s()-]{7,}$/.test(s)) return `***${s.replace(/\D/g, '').slice(-2)}`;
      return s.slice(0, 60);
    }),
  );
}

const SYSTEM = `You map spreadsheet columns to CRM fields for a cold email platform.
Rules:
- Only use the headers and masked sample values supplied.
- Never invent a column, a value, or a person's data.
- Choose one mapped_field per column from: ${CRM_FIELDS.join(', ')}.
- Mark ambiguous when the header or samples do not clearly support the mapping.
- confidence must reflect real uncertainty.
- missing_fields lists standard fields (email, first_name, company) absent from the file.
- suggested_variables lists usable personalization variables found in the file.
Return JSON only: {"columns":[{"name","mapped_field","confidence","ambiguous","reason","sample"}],"missing_fields":[],"suggested_variables":[],"notes":[]}`;

export async function analyzeColumns(input: {
  organizationId: string;
  userId: string;
  headers: string[];
  sampleRows: (string | number | null)[][];
  totalRows: number;
}): Promise<ColumnAnalysis> {
  const fallback = heuristicMap(input.headers, input.sampleRows);
  fallback.detected.totalRows = input.totalRows;

  try {
    const result = await callGroqJson({
      system: SYSTEM,
      user: `Headers: ${JSON.stringify(input.headers)}\nMasked sample rows (up to 8): ${JSON.stringify(maskSamples(input.sampleRows.slice(0, 8)))}`,
      schema: aiColumnSchema,
      temperature: 0.1,
      maxTokens: 1600,
    });

    const headerSet = new Set(input.headers);
    const columns = result.data.columns
      .filter((c) => headerSet.has(c.name))
      .map((c) => ({
        name: c.name,
        mappedField: c.mapped_field,
        confidence: c.confidence,
        ambiguous: c.ambiguous || c.confidence < 0.65,
        reason: c.reason,
        sample: c.sample,
      }));

    // Keep columns the model omitted, visibly unmapped rather than silently dropped.
    for (const header of input.headers) {
      if (!columns.some((c) => c.name === header)) {
        columns.push({ name: header, mappedField: 'ignore', confidence: 0, ambiguous: true, reason: 'Not mapped by the analysis; review manually.', sample: undefined });
      }
    }

    const emailCol = columns.find((c) => c.mappedField === 'email')?.name ?? null;

    await recordAiUsage({ organizationId: input.organizationId, userId: input.userId, kind: 'column_analysis', usage: result.usage });
    await createGeneration(input, result.data, result.usage);

    return {
      source: 'ai',
      columns,
      missingFields: result.data.missing_fields,
      suggestedVariables: result.data.suggested_variables,
      ambiguousColumns: columns.filter((c) => c.ambiguous).map((c) => c.name),
      notes: [
        ...result.data.notes,
        'AI mapping is a suggestion only. Verify each field before importing.',
      ],
      detected: detectRows(input.headers, input.sampleRows, emailCol),
    };
  } catch (error) {
    console.warn('[ai] column analysis unavailable, using heuristic mapping:', error instanceof Error ? error.message : error);
    return {
      ...fallback,
      notes: [
        ...fallback.notes,
        'AI analysis was unavailable, so deterministic header matching was used. No AI call was charged.',
      ],
    };
  }
}

async function createGeneration(
  input: { organizationId: string; userId: string; headers: string[] },
  output: unknown,
  usage: { model: string; tokensIn: number; tokensOut: number },
) {
  const { createServiceClient } = await import('@/lib/supabase/service');
  await createServiceClient()
    .from('ai_generations')
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      kind: 'column_analysis',
      model: usage.model,
      prompt_version: 'column_analysis:v1',
      input: { headers: input.headers },
      output,
      status: 'succeeded',
      tokens_in: usage.tokensIn,
      tokens_out: usage.tokensOut,
    });
}
