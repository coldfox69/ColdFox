import 'server-only';
import { z } from 'zod';
import { callGroqJson, recordAiUsage } from '@/lib/ai/groq';
import { createServiceClient } from '@/lib/supabase/service';
import type { LeadListColumn } from '@/lib/placeholders';

export const personalizationSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  notes: z.array(z.string().max(300)).max(8).default([]),
});
export type PersonalizationOutput = z.infer<typeof personalizationSchema>;

const SYSTEM = `You personalize cold outreach emails for one specific recipient.
Hard rules:
- Preserve the original intent, structure and language of the template.
- Use ONLY the facts supplied about this lead. Never invent facts, roles, relationships, funding, news, or company details.
- Do not add new claims. Light, honest tailoring is allowed (referencing their real role or company only if it appears in the facts).
- Keep the email natural and professional. Avoid exaggeration and false urgency.
- Keep unsubscribe information untouched; do not add or remove it.
- Do not prepend "RE:" or disguise the email as a reply.
- Keep {{sender_name}} and {{sender_company}} as literal placeholders if they appear.
Return JSON only: {"subject": string, "body": string, "notes": string[]}
notes briefly lists what was personalized (max 8 items).`;

/**
 * Personalize a template for a single recipient.
 * Only the minimum data needed for this recipient is included in the prompt.
 */
export async function personalizeForRecipient(input: {
  organizationId: string;
  userId: string;
  lead: Record<string, unknown>;
  columns: LeadListColumn[];
  subject: string;
  body: string;
  senderName: string;
  senderCompany?: string | null;
  campaignName?: string | null;
}): Promise<PersonalizationOutput> {
  const facts = buildFacts(input.lead, input.columns);
  if (!facts) {
    // Not enough signal to personalize; the caller should fall back to the original.
    return { subject: input.subject, body: input.body, notes: ['not enough data to personalize'] };
  }

  const user = [
    `Campaign: ${input.campaignName ?? 'cold outreach'}`,
    `Sender name: ${input.senderName}${input.senderCompany ? ` (${input.senderCompany})` : ''}`,
    `Verified facts about this recipient (use only these; invent nothing):\n${facts}`,
    `Template subject:\n${input.subject}`,
    `Template body:\n${input.body}`,
  ].join('\n\n');

  const result = await callGroqJson({
    system: SYSTEM,
    user,
    schema: personalizationSchema,
    temperature: 0.3,
    maxTokens: 1200,
  });
  await recordAiUsage({ organizationId: input.organizationId, userId: input.userId, kind: 'email', usage: result.usage });

  const subject = sanitizePersonalizedSubject(result.data.subject, input.subject);
  const body = sanitizePersonalizedBody(result.data.body, input.body);
  return { subject, body, notes: result.data.notes };
}

function buildFacts(lead: Record<string, unknown>, columns: LeadListColumn[]): string {
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  const standard: Record<string, unknown> = {
    first_name: lead.first_name,
    last_name: lead.last_name,
    email: lead.email,
    company_name: lead.company_name,
    job_title: lead.job_title,
    website: lead.website,
    industry: lead.industry,
    city: lead.city,
    country: lead.country,
  };
  const custom = (lead.custom_data as Record<string, unknown>) ?? {};
  const wanted = new Map<string, string>();
  for (const [key, value] of Object.entries(standard)) {
    const text = str(value);
    if (text) wanted.set(key, text.slice(0, 200));
  }
  for (const [key, value] of Object.entries(custom)) {
    const text = str(value);
    if (text) wanted.set(key, text.slice(0, 200));
  }
  // Limit to the columns the template actually used when provided.
  const usable = columns.length ? columns.filter((c) => wanted.has(c.key)) : [];
  const entries = (usable.length ? usable.map((c) => [c.key, wanted.get(c.key)!] as const) : [...wanted.entries()]).slice(0, 20);
  return entries.map(([key, value]) => `- ${key}: ${value}`).join('\n');
}

function sanitizePersonalizedSubject(subject: string, original: string): string {
  const cleaned = subject.replace(/^\s*re:\s*/i, '').trim();
  if (!cleaned || cleaned.length > 300) return original;
  return cleaned;
}

function sanitizePersonalizedBody(body: string, original: string): string {
  // Keep the body bounded; never let the model explode the email size.
  const cleaned = body.trim().slice(0, 20000);
  return cleaned || original;
}

/** Sample personalization for previews before launch (max 3 leads). */
export async function personalizeSamples(input: {
  organizationId: string;
  userId: string;
  leads: Record<string, unknown>[];
  columns: LeadListColumn[];
  subject: string;
  body: string;
  senderName: string;
  senderCompany?: string | null;
  campaignName?: string | null;
}): Promise<{ lead_id: string; email: string; subject: string; body: string; ai: boolean; notes: string[] }[]> {
  const samples = input.leads.slice(0, 3);
  const out: { lead_id: string; email: string; subject: string; body: string; ai: boolean; notes: string[] }[] = [];
  for (const lead of samples) {
    try {
      const result = await personalizeForRecipient({ ...input, lead });
      out.push({ lead_id: String(lead.id), email: String(lead.email), subject: result.subject, body: result.body, ai: true, notes: result.notes });
    } catch (error) {
      console.warn('[ai] personalized sample failed, returning original:', error instanceof Error ? error.message : error);
      out.push({ lead_id: String(lead.id), email: String(lead.email), subject: input.subject, body: input.body, ai: false, notes: ['AI unavailable; showing the original template.'] });
    }
  }
  return out;
}

/** Deliverability review: suggest improvements, never claim a spam-free inbox. */
export const deliverabilityReviewSchema = z.object({
  improved_subject: z.string().trim().min(1).max(300),
  improved_body: z.string().trim().min(1).max(20000),
  changes: z.array(z.string().max(400)).max(20).default([]),
  checks: z.object({
    spam_like_language: z.enum(['pass', 'warn', 'fail']).default('pass'),
    excessive_promotion: z.enum(['pass', 'warn', 'fail']).default('pass'),
    misleading_claims: z.enum(['pass', 'warn', 'fail']).default('pass'),
    capitalization: z.enum(['pass', 'warn', 'fail']).default('pass'),
    punctuation: z.enum(['pass', 'warn', 'fail']).default('pass'),
    links: z.enum(['pass', 'warn', 'fail']).default('pass'),
    formatting: z.enum(['pass', 'warn', 'fail']).default('pass'),
    unnatural_personalization: z.enum(['pass', 'warn', 'fail']).default('pass'),
    clarity: z.enum(['pass', 'warn', 'fail']).default('pass'),
  }).default({
    spam_like_language: 'pass', excessive_promotion: 'pass', misleading_claims: 'pass',
    capitalization: 'pass', punctuation: 'pass', links: 'pass', formatting: 'pass',
    unnatural_personalization: 'pass', clarity: 'pass',
  }),
  issues: z.array(z.string().max(400)).max(20).default([]),
});
export type DeliverabilityReview = z.infer<typeof deliverabilityReviewSchema>;

const REVIEW_SYSTEM = `You are a deliverability copy reviewer for a B2B cold email platform.
Your job is to make the email read naturally and honestly. You do NOT promise inbox placement, spam-filter evasion, or a "guaranteed" result.
Rules:
- Preserve the original meaning, legitimate claims and offer. Do not invent facts.
- Remove spam-like language, exaggerated promotion, ALL CAPS, excessive punctuation, and too many links.
- Keep it clear, concise and relevant. Keep placeholders like {{first_name}} intact.
- Never brand the output as "guaranteed delivery" or "spam-free".
Return JSON only: {"improved_subject": string, "improved_body": string,
 "changes": string[], "checks": {"spam_like_language": "pass|warn|fail", ...},
 "issues": string[]}
changes lists what you changed. issues lists anything the user must verify themselves.`;

export async function reviewForDeliverability(input: {
  organizationId: string;
  userId: string;
  subject: string;
  body: string;
}): Promise<DeliverabilityReview> {
  const result = await callGroqJson({
    system: REVIEW_SYSTEM,
    user: `Subject:\n${input.subject}\n\nBody:\n${input.body}`,
    schema: deliverabilityReviewSchema,
    temperature: 0.2,
    maxTokens: 1600,
  });
  await recordAiUsage({ organizationId: input.organizationId, userId: input.userId, kind: 'optimize', usage: result.usage });
  await createServiceClient()
    .from('template_ai_reviews')
    .insert({
      organization_id: input.organizationId,
      subject_before: input.subject,
      body_before: input.body,
      subject_after: result.data.improved_subject,
      body_after: result.data.improved_body,
      explanation: { changes: result.data.changes, issues: result.data.issues, checks: result.data.checks },
      created_by: input.userId,
    })
    .then(() => undefined, () => undefined);
  return result.data;
}

/** Human-readable explanation used in the UI hint and audit trail. */
export function reviewDisclaimer() {
  return 'AI review improves clarity, formatting and honesty. It cannot guarantee inbox placement or that any provider will accept the message.';
}
