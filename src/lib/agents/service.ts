/**
 * Server side access to the AI agent catalog.
 *
 * The catalog is shared by every workspace. API keys never leave the server:
 * they are encrypted with the same key that protects mailbox credentials and
 * are only decrypted inside the runner that talks to the agent API.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import type {
  AgentApiConfig,
  AgentDetail,
  AgentFieldDefinition,
  AgentOutreachSettings,
  AgentSummary,
} from './types';

export interface AgentRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  purpose: string | null;
  icon: string;
  category: string;
  status: 'draft' | 'published' | 'disabled';
  agent_type: 'builtin' | 'external';
  input_schema: AgentFieldDefinition[];
  api_config: AgentApiConfig;
  supports_outreach: boolean;
  outreach_defaults: AgentOutreachSettings;
  sort_order: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface AgentCredentialPayload {
  api_key?: string;
  [key: string]: unknown;
}

function fieldsOf(row: AgentRow): AgentFieldDefinition[] {
  if (!Array.isArray(row.input_schema)) return [];
  return row.input_schema.filter((field): field is AgentFieldDefinition =>
    Boolean(field) && typeof field === 'object' && typeof (field as AgentFieldDefinition).key === 'string',
  );
}

export function toAgentSummary(row: AgentRow, apiConfigured: boolean): AgentSummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? '',
    purpose: row.purpose ?? '',
    icon: row.icon,
    category: row.category,
    status: row.status,
    agentType: row.agent_type,
    supportsOutreach: row.supports_outreach,
    apiConfigured,
    updatedAt: row.updated_at,
  };
}

export function toAgentDetail(row: AgentRow, apiConfigured: boolean): AgentDetail {
  return {
    ...toAgentSummary(row, apiConfigured),
    fields: fieldsOf(row),
    outreachDefaults: (row.outreach_defaults ?? {}) as AgentOutreachSettings,
    apiConfiguredDetails: {
      baseUrl: row.api_config?.base_url ?? '',
      authType: row.api_config?.auth_type ?? 'bearer',
      path: row.api_config?.path ?? '',
    },
  };
}

export async function listAgents(db: SupabaseClient, options: { publishedOnly?: boolean } = {}) {
  let query = db.from('ai_agents').select('*').order('sort_order').order('name');
  if (options.publishedOnly) query = query.eq('status', 'published');
  const { data, error } = await query;
  if (error) throw new Error(`Could not load the agent catalog: ${error.message}`);
  const rows = (data ?? []) as unknown as AgentRow[];
  const configured = await configuredAgentIds(db, rows.map((row) => row.id));
  return rows.map((row) => ({ row, apiConfigured: configured.has(row.id) }));
}

export async function getAgentBySlug(db: SupabaseClient, slug: string) {
  const { data, error } = await db.from('ai_agents').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new Error(`Could not load the agent: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as AgentRow;
  const { data: credential } = await db.from('ai_agent_credentials').select('agent_id').eq('agent_id', row.id).maybeSingle();
  return { row, apiConfigured: Boolean(credential) };
}

export async function getAgentById(db: SupabaseClient, id: string) {
  const { data, error } = await db.from('ai_agents').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not load the agent: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as AgentRow;
  const { data: credential } = await db.from('ai_agent_credentials').select('agent_id').eq('agent_id', row.id).maybeSingle();
  return { row, apiConfigured: Boolean(credential) };
}

async function configuredAgentIds(db: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const { data } = await db.from('ai_agent_credentials').select('agent_id').in('agent_id', ids);
  return new Set((data ?? []).map((row) => String(row.agent_id)));
}

/** Store the API key of an agent. The value is encrypted before it is written. */
export async function saveAgentCredential(db: SupabaseClient, agentId: string, payload: AgentCredentialPayload) {
  const encrypted = encryptSecret(payload);
  const { error } = await db.from('ai_agent_credentials').upsert(
    { agent_id: agentId, encrypted_payload: encrypted, key_version: 1, updated_at: new Date().toISOString() },
    { onConflict: 'agent_id' },
  );
  if (error) throw new Error(`Could not store the agent credential: ${error.message}`);
}

export async function removeAgentCredential(db: SupabaseClient, agentId: string) {
  const { error } = await db.from('ai_agent_credentials').delete().eq('agent_id', agentId);
  if (error) throw new Error(`Could not remove the agent credential: ${error.message}`);
}

export async function readAgentCredential(db: SupabaseClient, agentId: string): Promise<AgentCredentialPayload | null> {
  const { data } = await db.from('ai_agent_credentials').select('encrypted_payload').eq('agent_id', agentId).maybeSingle();
  if (!data?.encrypted_payload) return null;
  try {
    return decryptSecret<AgentCredentialPayload>(data.encrypted_payload as string);
  } catch (error) {
    console.error('[agents] could not decrypt the credential', error);
    return null;
  }
}
