/**
 * Pure helpers for the agent input schema and for agent API responses.
 *
 * Nothing here touches the database or the network, so the same code runs in
 * the browser (to render and validate the dynamic form) and on the server
 * (to validate the request again and to read the agent response).
 */

import type { AgentFieldDefinition, AgentLeadRow } from './types';

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** A value the user can put into an agent field. */
export type AgentInputValue = string | number | boolean | string[];

export function emptyInputs(fields: AgentFieldDefinition[]): Record<string, AgentInputValue> {
  const out: Record<string, AgentInputValue> = {};
  for (const field of fields) {
    if (field.default !== undefined) out[field.key] = field.default;
    else if (field.type === 'boolean') out[field.key] = false;
    else if (field.type === 'multiselect') out[field.key] = [];
    else out[field.key] = '';
  }
  return out;
}

function isBlank(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Coerce the raw form values into the shape the agent expects.
 * Numbers become numbers, booleans stay booleans, everything else is trimmed.
 */
export function coerceAgentInputs(
  fields: AgentFieldDefinition[],
  raw: Record<string, unknown>,
): Record<string, AgentInputValue> {
  const out: Record<string, AgentInputValue> = {};
  for (const field of fields) {
    const value = raw[field.key];
    if (value === undefined || value === null) continue;
    if (field.type === 'boolean') {
      out[field.key] = value === true || value === 'true' || value === 1 || value === '1';
      continue;
    }
    if (field.type === 'number') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) out[field.key] = parsed;
      continue;
    }
    if (field.type === 'multiselect') {
      out[field.key] = (Array.isArray(value) ? value : [value]).map((entry) => String(entry).trim()).filter(Boolean);
      continue;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) out[field.key] = trimmed.slice(0, field.maxLength ?? 4000);
      continue;
    }
    out[field.key] = String(value);
  }
  return out;
}

/** Human readable problems with the submitted inputs. Empty means valid. */
export function validateAgentInputs(
  fields: AgentFieldDefinition[],
  inputs: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    const value = inputs[field.key];
    if (field.required && isBlank(value)) {
      errors.push(`${field.label} is required.`);
      continue;
    }
    if (isBlank(value)) continue;
    if (field.type === 'email' && typeof value === 'string' && !EMAIL_RE.test(value.trim())) {
      errors.push(`${field.label} must be an email address.`);
      continue;
    }
    if (field.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        errors.push(`${field.label} must be a number.`);
        continue;
      }
      if (typeof field.min === 'number' && parsed < field.min) {
        errors.push(`${field.label} cannot be lower than ${field.min}.`);
        continue;
      }
      if (typeof field.max === 'number' && parsed > field.max) {
        errors.push(`${field.label} cannot be higher than ${field.max}.`);
        continue;
      }
    }
    if (field.type === 'select' && Array.isArray(field.options) && field.options.length) {
      const allowed = field.options.map((option) => option.value);
      if (typeof value === 'string' && !allowed.includes(value)) {
        errors.push(`${field.label} must be one of the listed options.`);
      }
    }
    if (field.maxLength && typeof value === 'string' && value.length > field.maxLength) {
      errors.push(`${field.label} must be ${field.maxLength} characters or fewer.`);
    }
  }
  return errors;
}

/** Read a dotted path out of an API response, e.g. "data.leads". */
export function readPath(payload: unknown, path?: string): unknown {
  if (!path) return payload;
  let current: unknown = payload;
  for (const segment of path.split('.').map((part) => part.trim()).filter(Boolean)) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

const EMAIL_KEYS = ['email', 'email_address', 'emailAddress', 'contact_email', 'contactEmail', 'mail'];
const FIRST_NAME_KEYS = ['first_name', 'firstName', 'firstname', 'given_name'];
const LAST_NAME_KEYS = ['last_name', 'lastName', 'lastname', 'family_name', 'surname'];
const COMPANY_KEYS = ['company', 'company_name', 'companyName', 'organization', 'organisation', 'business'];
const JOB_TITLE_KEYS = ['job_title', 'jobTitle', 'title', 'role', 'position'];
const WEBSITE_KEYS = ['website', 'url', 'site', 'domain', 'store_url', 'storeUrl'];
const INDUSTRY_KEYS = ['industry', 'niche', 'category', 'sector', 'vertical'];
const PHONE_KEYS = ['phone', 'phone_number', 'phoneNumber', 'telephone'];
const LINKEDIN_KEYS = ['linkedin_url', 'linkedinUrl', 'linkedin', 'linkedin_profile'];
const CITY_KEYS = ['city', 'town', 'locality'];
const COUNTRY_KEYS = ['country', 'country_code', 'countryCode', 'nation'];

const KNOWN_KEYS = new Set(
  [...EMAIL_KEYS, ...FIRST_NAME_KEYS, ...LAST_NAME_KEYS, ...COMPANY_KEYS, ...JOB_TITLE_KEYS,
    ...WEBSITE_KEYS, ...INDUSTRY_KEYS, ...PHONE_KEYS, ...LINKEDIN_KEYS, ...CITY_KEYS, ...COUNTRY_KEYS]
    .map((key) => key.toLowerCase()),
);

function pick(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text.slice(0, 300);
  }
  return null;
}

/**
 * Turn whatever the agent API returned into lead rows.
 *
 * Only rows that carry a valid email address are kept. Nothing is invented:
 * a response without usable leads produces an empty list.
 */
export function extractLeadRows(payload: unknown, resultsPath?: string): AgentLeadRow[] {
  const candidate = readPath(payload, resultsPath);
  let list: unknown[] = [];
  if (Array.isArray(candidate)) list = candidate;
  else if (candidate && typeof candidate === 'object') {
    const record = candidate as Record<string, unknown>;
    for (const key of ['leads', 'results', 'items', 'data', 'rows', 'contacts']) {
      if (Array.isArray(record[key])) {
        list = record[key] as unknown[];
        break;
      }
    }
  }

  const rows: AgentLeadRow[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const email = pick(record, EMAIL_KEYS)?.toLowerCase() ?? '';
    if (!EMAIL_RE.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);

    const extra: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      if (KNOWN_KEYS.has(key.toLowerCase())) continue;
      if (value === null || value === undefined || typeof value === 'object') continue;
      const text = String(value).trim();
      if (text) extra[key.slice(0, 60)] = text.slice(0, 300);
    }

    rows.push({
      email,
      first_name: pick(record, FIRST_NAME_KEYS),
      last_name: pick(record, LAST_NAME_KEYS),
      company_name: pick(record, COMPANY_KEYS),
      job_title: pick(record, JOB_TITLE_KEYS),
      website: pick(record, WEBSITE_KEYS),
      industry: pick(record, INDUSTRY_KEYS),
      phone: pick(record, PHONE_KEYS),
      linkedin_url: pick(record, LINKEDIN_KEYS),
      city: pick(record, CITY_KEYS),
      country: pick(record, COUNTRY_KEYS),
      extra: Object.keys(extra).length ? extra : undefined,
    });
  }
  return rows;
}

/** Slug used in the URL of an agent page. */
export function agentSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'agent'
  );
}
