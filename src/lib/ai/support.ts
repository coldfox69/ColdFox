import 'server-only';
import { z } from 'zod';
import { callGroqJson, recordAiUsage } from '@/lib/ai/groq';
import { createServiceClient } from '@/lib/supabase/service';

const supportSchema = z.object({
  answer: z.string().trim().min(1).max(4000),
  sources: z.array(z.string().max(120)).max(6).default([]),
  escalate: z.boolean().default(false),
  escalation_reason: z.string().max(400).optional(),
});

export interface SupportAnswer {
  answer: string;
  sources: string[];
  escalate: boolean;
  escalationReason?: string;
  aiUsed: boolean;
}

export async function answerSupportQuestion(input: {
  organizationId: string;
  userId: string;
  question: string;
}): Promise<SupportAnswer> {
  const service = createServiceClient();
  const { data: articles } = await service
    .from('kb_articles')
    .select('slug, title, body, category')
    .eq('is_published', true)
    .limit(20);

  const kb = articles ?? [];

  if (!process.env.GROQ_API_KEY) {
    // Deterministic retrieval, clearly not an AI answer.
    const words = input.question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const ranked = kb
      .map((a) => ({ ...a, score: words.filter((w) => `${a.title} ${a.body}`.toLowerCase().includes(w)).length }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (best && best.score > 0) {
      return {
        answer: `${best.title}\n\n${best.body}\n\nIf this does not resolve your issue, open a support ticket and our team will follow up.`,
        sources: [best.slug],
        escalate: false,
        aiUsed: false,
      };
    }
    return {
      answer: 'I could not find a documented answer to that question. Please open a support ticket so a human can help. I will not guess at policies or account actions.',
      sources: [],
      escalate: true,
      escalationReason: 'No matching knowledge base article and AI is not configured.',
      aiUsed: false,
    };
  }

  const result = await callGroqJson({
    system: `You are the ColdFox support assistant. Answer ONLY from the knowledge base supplied.
- Never invent policies, prices, features, or actions. Never claim you performed an action.
- If the knowledge base does not answer the question, set escalate=true and say a human will help.
- Be concise and practical.
Return JSON only: {"answer": string, "sources": string[], "escalate": boolean, "escalation_reason": string}`,
    user: `Question: ${input.question}\n\nKnowledge base:\n${kb.map((a) => `### ${a.title} (${a.slug})\n${a.body}`).join('\n\n')}`,
    schema: supportSchema,
    temperature: 0.2,
    maxTokens: 900,
  });

  await recordAiUsage({ organizationId: input.organizationId, userId: input.userId, kind: 'support', usage: result.usage });
  await service.from('ai_generations').insert({
    organization_id: input.organizationId,
    user_id: input.userId,
    kind: 'support',
    model: result.usage.model,
    prompt_version: 'support_assistant:v1',
    input: { question: input.question },
    output: result.data,
    status: 'succeeded',
    tokens_in: result.usage.tokensIn,
    tokens_out: result.usage.tokensOut,
  });

  return {
    answer: result.data.answer,
    sources: result.data.sources,
    escalate: result.data.escalate,
    escalationReason: result.data.escalation_reason,
    aiUsed: true,
  };
}
