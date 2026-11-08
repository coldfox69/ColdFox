import 'server-only';
import { z } from 'zod';
import { ApiError } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase/service';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export interface AiUsage {
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export async function callGroqJson<T>(options: {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}): Promise<{ data: T; usage: AiUsage; raw: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ApiError(503, 'AI is not configured on this deployment. Add GROQ_API_KEY to enable it.', 'ai_not_configured');
  }
  const model = options.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const request = async (extra: string) => {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: options.temperature ?? 0.5,
        max_tokens: options.maxTokens ?? 1400,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.user + extra },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[groq] request failed', response.status, text.slice(0, 400));
      if (response.status === 429) throw new ApiError(429, 'The AI service is busy. Please try again in a moment.', 'ai_rate_limited');
      throw new ApiError(502, 'The AI service could not complete this request.', 'ai_upstream_error');
    }
    return (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
  };

  const attempt = async (extra: string) => {
    const payload = await request(extra);
    const raw = payload.choices?.[0]?.message?.content ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(502, 'The AI returned an unreadable response. Please retry.', 'ai_bad_json');
    }
    const result = options.schema.safeParse(parsed);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new ApiError(502, `The AI response did not match the expected format (${issue?.path.join('.')}).`, 'ai_schema_mismatch');
    }
    return {
      data: result.data,
      raw,
      usage: {
        model,
        tokensIn: payload.usage?.prompt_tokens ?? 0,
        tokensOut: payload.usage?.completion_tokens ?? 0,
      } satisfies AiUsage,
    };
  };

  try {
    return await attempt('');
  } catch (error) {
    // One repair retry for malformed JSON / schema mismatch only.
    if (error instanceof ApiError && ['ai_bad_json', 'ai_schema_mismatch'].includes(error.code ?? '')) {
      return attempt('\n\nYour previous response was not valid JSON matching the required schema. Return only valid JSON.');
    }
    throw error;
  }
}

export async function recordAiUsage(input: {
  organizationId: string;
  userId: string;
  kind: string;
  generationId?: string;
  usage: AiUsage;
}) {
  const service = createServiceClient();
  await Promise.allSettled([
    service.from('ai_usage_records').insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      kind: input.kind,
      tokens: input.usage.tokensIn + input.usage.tokensOut,
    }),
    service.rpc('record_usage', {
      p_org: input.organizationId,
      p_metric: 'ai_credits',
      p_quantity: 1,
      p_metadata: { kind: input.kind, model: input.usage.model },
    }),
  ]);
}
