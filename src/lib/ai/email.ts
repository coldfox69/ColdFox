import 'server-only';
import { z } from 'zod';
import { ApiError } from '@/lib/http';
import { callGroqJson, callGroqStream, recordAiUsage, type AiUsage } from '@/lib/ai/groq';
import { createServiceClient } from '@/lib/supabase/service';

export const aiEmailOutputSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  subjects: z.array(z.string().trim().min(1).max(200)).max(8).optional(),
  warnings: z.array(z.string().max(500)).max(12).default([]),
  unsupported_claims: z.array(z.string().max(500)).max(12).default([]),
  suggestions: z.array(z.string().max(500)).max(12).default([]),
  compliance: z
    .object({
      sender_identity_present: z.boolean().optional(),
      unsubscribe_present: z.boolean().optional(),
      clear_purpose: z.boolean().optional(),
      no_deceptive_subject: z.boolean().optional(),
    })
    .default({}),
});

export type AiEmailOutput = z.infer<typeof aiEmailOutputSchema>;

const SYSTEM = `You are ColdFox's careful B2B outreach writing assistant.
Hard rules:
- Write concise, truthful, specific emails. No fabricated facts, no invented relationships, no fake familiarity.
- Use ONLY the lead facts supplied. If a detail is missing, do not invent it and do not reference it.
- Never guarantee replies, meetings, revenue, deliverability, or inbox placement. Never claim an email is "spam-free".
- Avoid deceptive subject lines, false urgency, exaggerated promotion, and unsupported claims.
- Do not write spam-filter evasion, disguised identities, or misleading rewordings.
- Include a clear reason for contacting the recipient and a plain sign-off using the supplied sender name.
- Marketing email must be identifiable as commercial; the platform adds an unsubscribe link automatically, so do not invent one unless asked.
- The human user reviews and approves every email before it is sent.

Return JSON only with this shape:
{"subject": string, "body": string, "subjects": string[], "warnings": string[], "unsupported_claims": string[], "suggestions": string[], "compliance": {"sender_identity_present": boolean, "unsubscribe_present": boolean, "clear_purpose": boolean, "no_deceptive_subject": boolean}}
The body is plain text with real line breaks, no markdown fences. Variables like {{first_name}} may be used only when the user supplied them as variables.`;

export type AiEmailInput = {
  organizationId: string;
  userId: string;
  mode: 'generate' | 'rewrite' | 'optimize' | 'subjects' | 'follow_up';
  prompt: string;
  tone: string;
  subject?: string;
  body?: string;
  lead?: Record<string, string | undefined>;
  sender?: { name: string; company?: string };
  context?: string;
};

/** Plan-level AI credit check (configurable per plan, not hardcoded). */
async function assertAiCredits(organizationId: string) {
  const service = createServiceClient();
  const { data: allowed, error: limitError } = await service.rpc('check_org_limit', {
    p_org: organizationId,
    p_metric: 'ai_credits',
    p_increment: 1,
  });
  if (limitError) console.warn('[ai] limit check failed', limitError.message);
  if (allowed === false) {
    throw new ApiError(402, 'You have used all AI credits on your current plan. Upgrade or wait for the next billing period.', 'ai_credit_limit');
  }
}

function buildPrompt(input: AiEmailInput): { user: string; temperature: number } {
  const leadFacts = Object.entries(input.lead ?? {})
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `- ${k}: ${String(v).trim()}`)
    .join('\n');

  let instruction: string;
  switch (input.mode) {
    case 'rewrite':
      instruction = `Rewrite the email below in a ${input.tone} tone. Preserve the true facts. Do not add new claims.`;
      break;
    case 'optimize':
      instruction = `Review and improve the email below for clarity, relevance and honesty. Flag unsupported claims, exaggeration, deceptive subject lines, missing sender identity and missing unsubscribe information. Provide an improved version plus findings.`;
      break;
    case 'subjects':
      instruction = `Propose up to 6 honest subject lines (max 60 characters) for the email below. Do not use clickbait or false urgency. Keep the original body unchanged.`;
      break;
    case 'follow_up':
      instruction = `Write a brief, polite follow-up (under 90 words) that adds value. Do not guilt the recipient, pretend you know them, or invent prior conversations.`;
      break;
    default:
      instruction = `Write a new cold outreach email in a ${input.tone} tone. Keep it under 140 words. One clear, low-pressure call to action.`;
  }

  const user = [
    instruction,
    `User brief: ${input.prompt}`,
    input.context ? `Additional context: ${input.context}` : '',
    leadFacts ? `Verified lead facts (use only these; do not invent):\n${leadFacts}` : 'No lead facts supplied. Use neutral placeholders or omit personal details. Do not invent any.',
    input.sender?.name ? `Sender name: ${input.sender.name}. Sender company: ${input.sender.company ?? 'not supplied'}.` : 'Sender name was not supplied; use the literal variable {{sender_name}}.',
    input.subject ? `Current subject:\n${input.subject}` : '',
    input.body ? `Current body:\n${input.body}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { user, temperature: input.mode === 'optimize' ? 0.25 : 0.55 };
}

async function persistGeneration(
  input: AiEmailInput,
  output: AiEmailOutput,
  usage: AiUsage,
): Promise<string | null> {
  const service = createServiceClient();
  let generationId: string | null = null;
  try {
    const { data } = await service
      .from('ai_generations')
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        kind: input.mode === 'subjects' ? 'subject' : input.mode === 'optimize' ? 'optimize' : input.mode === 'rewrite' ? 'rewrite' : 'email',
        model: usage.model,
        prompt_version: 'email_writer:v1',
        input: { mode: input.mode, tone: input.tone, prompt: input.prompt, subject: input.subject, body: input.body, lead: input.lead },
        output,
        status: 'succeeded',
        tokens_in: usage.tokensIn,
        tokens_out: usage.tokensOut,
      })
      .select('id')
      .single();
    generationId = data?.id ?? null;
  } catch (error) {
    console.warn('[ai] failed to persist generation', error);
  }

  await recordAiUsage({ organizationId: input.organizationId, userId: input.userId, kind: 'email', usage });
  return generationId;
}

export async function generateAiEmail(
  input: AiEmailInput,
): Promise<AiEmailOutput & { generationId: string | null; model: string }> {
  await assertAiCredits(input.organizationId);
  const { user, temperature } = buildPrompt(input);

  const result = await callGroqJson({
    system: SYSTEM,
    user,
    schema: aiEmailOutputSchema,
    temperature,
    maxTokens: 1400,
  });

  const generationId = await persistGeneration(input, result.data, result.usage);
  return { ...result.data, generationId, model: result.usage.model };
}

export type AiStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; data: AiEmailOutput & { generationId: string | null; model: string } };

/**
 * Streaming variant. Yields raw text deltas as they arrive so the client can
 * render the draft token by token, then a final `done` event with the parsed
 * and validated result.
 */
export async function* generateAiEmailStream(
  input: AiEmailInput,
  signal?: AbortSignal,
): AsyncGenerator<AiStreamEvent, void, void> {
  await assertAiCredits(input.organizationId);
  const { user, temperature } = buildPrompt(input);

  const stream = callGroqStream({
    system: SYSTEM,
    user,
    temperature,
    maxTokens: 1400,
    signal,
  });

  let raw = '';
  let usage: AiUsage | undefined;
  for await (const delta of stream) {
    raw += delta;
    yield { type: 'delta', text: delta };
  }

  const finalUsage = await stream.return(undefined as never).catch(() => undefined);
  usage = (finalUsage as AiUsage | undefined) ?? { model: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile', tokensIn: 0, tokensOut: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(502, 'The AI returned an unreadable response. Please retry.', 'ai_bad_json');
  }
  const result = aiEmailOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ApiError(502, `The AI response did not match the expected format (${issue?.path.join('.')}).`, 'ai_schema_mismatch');
  }

  const generationId = await persistGeneration(input, result.data, usage);
  yield { type: 'done', data: { ...result.data, generationId, model: usage.model } };
}
