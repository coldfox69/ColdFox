/**
 * Talking to an external agent API.
 *
 * Each agent can point at its own API. The endpoint and the auth style come
 * from the agent configuration, the secret from the encrypted credential store.
 * Nothing here is exposed to the browser.
 */

import 'server-only';
import type { AgentApiConfig, AgentFieldDefinition } from './types';
import type { AgentCredentialPayload, AgentRow } from './service';

const MAX_TIMEOUT_MS = 120_000;

export interface AgentCallResult {
  ok: boolean;
  status: number;
  payload: unknown;
  error?: string;
  url: string;
}

export interface AgentRequestPlan {
  url: string;
  method: 'POST' | 'GET';
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

/** Build the HTTP request for an agent without sending it. Exported for tests. */
export function buildAgentRequest(input: {
  agent: AgentRow;
  credential: AgentCredentialPayload | null;
  inputs: Record<string, unknown>;
}): { plan: AgentRequestPlan | null; error?: string } {
  const config: AgentApiConfig = input.agent.api_config ?? {};
  const baseUrl = String(config.base_url ?? '').trim();
  if (!baseUrl) {
    return { plan: null, error: 'This agent is not connected to an API yet.' };
  }

  const rawPath = String(config.path ?? '').trim();
  let url: string;
  if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
    url = rawPath;
  } else {
    url = `${baseUrl.replace(/\/+$/, '')}/${rawPath.replace(/^\/+/, '')}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const method: 'POST' | 'GET' = config.method === 'GET' ? 'GET' : 'POST';
  const apiKey = typeof input.credential?.api_key === 'string' ? input.credential.api_key.trim() : '';

  const authType = config.auth_type ?? 'bearer';
  if (authType === 'bearer' && apiKey) headers.Authorization = `Bearer ${apiKey}`;
  else if (authType === 'header' && apiKey) headers[config.header_name?.trim() || 'X-Api-Key'] = apiKey;
  else if (authType === 'query' && apiKey) url += `${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(apiKey)}`;

  const fields: AgentFieldDefinition[] = Array.isArray(input.agent.input_schema) ? input.agent.input_schema : [];
  const body = method === 'GET'
    ? undefined
    : JSON.stringify(config.body_mode === 'flat' ? input.inputs : { inputs: input.inputs });

  const timeoutMs = Math.min(MAX_TIMEOUT_MS, Math.max(5_000, Number(config.timeout_ms ?? 60_000)));

  return {
    plan: {
      url,
      method,
      headers,
      body,
      timeoutMs,
    },
    error: fields.length ? undefined : undefined,
  };
}

/** Call the agent API and return its parsed answer. */
export async function callAgentApi(input: {
  agent: AgentRow;
  credential: AgentCredentialPayload | null;
  inputs: Record<string, unknown>;
}): Promise<AgentCallResult> {
  const { plan, error } = buildAgentRequest(input);
  if (!plan) {
    return { ok: false, status: 0, payload: null, error: error ?? 'The agent API is not configured.', url: '' };
  }

  try {
    const response = await fetch(plan.url, {
      method: plan.method,
      headers: plan.headers,
      body: plan.body,
      signal: AbortSignal.timeout(plan.timeoutMs),
    });
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text.slice(0, 4000) };
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        payload,
        error: `The agent API answered with ${response.status}.`,
        url: plan.url,
      };
    }
    return { ok: true, status: response.status, payload, url: plan.url };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The agent API could not be reached.';
    return { ok: false, status: 0, payload: null, error: message.slice(0, 300), url: plan.url };
  }
}
