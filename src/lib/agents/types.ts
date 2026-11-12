/**
 * Shared shapes for the AI Agents feature.
 *
 * These types describe the contract between the admin console (which authors
 * an agent), the user panel (which renders it) and the runner (which calls the
 * agent API). They are intentionally free of server dependencies so the same
 * definitions can be used on both sides of the wire.
 */

export type AgentFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'date';

export interface AgentFieldOption {
  value: string;
  label: string;
}

/** One input the agent asks the user for. Rendered dynamically by the agent page. */
export interface AgentFieldDefinition {
  key: string;
  label: string;
  type: AgentFieldType;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: AgentFieldOption[];
  default?: string | number | boolean | string[];
  maxLength?: number;
  min?: number;
  max?: number;
}

export type AgentAuthType = 'bearer' | 'header' | 'query' | 'none';
export type AgentBodyMode = 'inputs' | 'flat';

/** How to reach the external agent. Never contains a secret. */
export interface AgentApiConfig {
  base_url?: string;
  path?: string;
  method?: 'POST' | 'GET';
  auth_type?: AgentAuthType;
  header_name?: string;
  timeout_ms?: number;
  body_mode?: AgentBodyMode;
  /** Where the leads live in the response, e.g. "data.leads". */
  results_path?: string;
}

/** The email outreach settings a user can attach to an agent task. */
export interface AgentOutreachSettings {
  enabled?: boolean;
  mailbox_id?: string | null;
  template_id?: string | null;
  campaign_name?: string;
  subject?: string;
  body?: string;
  timezone?: string;
  daily_limit?: number;
  send_window_start?: string;
  send_window_end?: string;
  weekdays?: number[];
  interval_min_seconds?: number;
  interval_max_seconds?: number;
  stop_on_reply?: boolean;
  ai_personalization?: boolean;
}

export type AgentStatus = 'draft' | 'published' | 'disabled';
export type AgentType = 'builtin' | 'external';
export type AgentRunStatus = 'queued' | 'running' | 'succeeded' | 'awaiting_api' | 'failed' | 'cancelled';

/** A lead as returned by an agent API, before it is imported. */
export interface AgentLeadRow {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  website?: string | null;
  industry?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  city?: string | null;
  country?: string | null;
  /** Any other value the agent returned, kept for the lead record. */
  extra?: Record<string, string>;
}

/** The agent as the user panel sees it. */
export interface AgentSummary {
  id: string;
  slug: string;
  name: string;
  description: string;
  purpose: string;
  icon: string;
  category: string;
  status: AgentStatus;
  agentType: AgentType;
  supportsOutreach: boolean;
  /** True when an administrator stored an API key for this agent. */
  apiConfigured: boolean;
  updatedAt: string;
}

export interface AgentDetail extends AgentSummary {
  fields: AgentFieldDefinition[];
  outreachDefaults: AgentOutreachSettings;
  /** Default values an administrator ships with the agent. */
  apiConfiguredDetails?: { baseUrl: string; authType: AgentAuthType; path: string };
}
