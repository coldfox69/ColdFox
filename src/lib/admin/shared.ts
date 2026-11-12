/**
 * Shared admin console definitions. Safe to import from client components:
 * no server-only code or secrets live here.
 */

export type AdminModuleKey =
  | 'overview'
  | 'analytics'
  | 'revenue'
  | 'users'
  | 'organizations'
  | 'leads'
  | 'campaigns'
  | 'mailboxes'
  | 'subscriptions'
  | 'plans'
  | 'billing'
  | 'tickets'
  | 'announcements'
  | 'ai-usage'
  | 'api-usage'
  | 'feature-flags'
  | 'settings'
  | 'jobs'
  | 'errors'
  | 'audit'
  | 'roles'
  | 'webhooks'
  | 'abuse'
  | 'integrations'
  | 'system-health'
  | 'email-activity';

export interface ModuleAccess {
  /** Permission required to read the module. */
  read: string;
  /** Permission required to create or edit records. Omit for read-only modules. */
  manage?: string;
  /** Permission required for destructive operations. Defaults to `manage`. */
  remove?: string;
}

export const ADMIN_MODULES: Record<string, ModuleAccess> = {
  overview: { read: 'orgs.view' },
  analytics: { read: 'analytics.view' },
  revenue: { read: 'analytics.view' },
  users: { read: 'users.view', manage: 'users.manage', remove: 'users.delete' },
  organizations: { read: 'orgs.view', manage: 'orgs.manage', remove: 'orgs.delete' },
  leads: { read: 'leads.view', manage: 'leads.manage', remove: 'leads.manage' },
  campaigns: { read: 'campaigns.view', manage: 'campaigns.manage', remove: 'campaigns.manage' },
  mailboxes: { read: 'mailboxes.view', manage: 'mailboxes.manage', remove: 'mailboxes.manage' },
  subscriptions: { read: 'billing.view', manage: 'billing.manage', remove: 'billing.manage' },
  plans: { read: 'billing.view', manage: 'plans.manage', remove: 'plans.manage' },
  billing: { read: 'billing.view', manage: 'billing.manage', remove: 'billing.manage' },
  tickets: { read: 'support.view', manage: 'support.manage', remove: 'support.manage' },
  announcements: { read: 'announcements.manage', manage: 'announcements.manage', remove: 'announcements.manage' },
  'ai-usage': { read: 'ai.view', manage: 'ai.manage', remove: 'ai.manage' },
  'ai-agents': { read: 'ai.manage', manage: 'ai.manage', remove: 'ai.manage' },
  'api-usage': { read: 'settings.manage' },
  'feature-flags': { read: 'flags.manage', manage: 'flags.manage', remove: 'flags.manage' },
  settings: { read: 'settings.manage', manage: 'settings.manage', remove: 'settings.manage' },
  jobs: { read: 'jobs.manage', manage: 'jobs.manage', remove: 'jobs.manage' },
  errors: { read: 'settings.manage', manage: 'settings.manage', remove: 'settings.manage' },
  audit: { read: 'audit.view' },
  roles: { read: 'admins.manage', manage: 'admins.manage', remove: 'admins.manage' },
  webhooks: { read: 'settings.manage', manage: 'settings.manage', remove: 'settings.manage' },
  abuse: { read: 'abuse.view' },
  integrations: { read: 'integrations.view' },
  'system-health': { read: 'settings.manage' },
  'email-activity': { read: 'campaigns.view' },
};

/** Permissions the signed-in admin holds. `*` means every permission. */
export function hasAdminPermission(permissions: string[] | undefined | null, permission: string | undefined | null): boolean {
  if (!permissions || !permission) return false;
  return permissions.includes('*') || permissions.includes(permission);
}

export function canReadModule(permissions: string[] | undefined | null, module: string): boolean {
  const access = ADMIN_MODULES[module];
  return Boolean(access && hasAdminPermission(permissions, access.read));
}

export function canManageModule(permissions: string[] | undefined | null, module: string): boolean {
  const access = ADMIN_MODULES[module];
  if (!access) return false;
  return Boolean(access.manage && hasAdminPermission(permissions, access.manage));
}

export function canDeleteModule(permissions: string[] | undefined | null, module: string): boolean {
  const access = ADMIN_MODULES[module];
  if (!access) return false;
  const required = access.remove ?? access.manage;
  return Boolean(required && hasAdminPermission(permissions, required));
}

/** Strip characters that would break a PostgREST `or` filter. */
export function safeSearch(value: string | null | undefined): string {
  return (value ?? '').replace(/[,()*%\\]/g, ' ').trim().slice(0, 120);
}

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface AdminListResponse<T = Record<string, unknown>> extends ListMeta {
  rows: T[];
  /** Optional second dataset rendered under the main table. */
  secondary?: {
    label: string;
    columns: Array<{ key: string; label: string; type?: AdminValueType }>;
    rows: Record<string, unknown>[];
  };
  summary?: Record<string, string | number | null>;
  facets?: Record<string, Array<{ value: string; label: string; count?: number }>>;
}

export type AdminValueType = 'text' | 'email' | 'date' | 'datetime' | 'bool' | 'money' | 'status' | 'number' | 'json';

export interface AdminDetailField {
  key: string;
  label: string;
  type?: AdminValueType;
  value?: unknown;
}

export interface AdminDetailSection {
  title: string;
  description?: string;
  columns?: Array<{ key: string; label: string; type?: AdminValueType }>;
  rows?: Record<string, unknown>[];
  fields?: AdminDetailField[];
}

export interface AdminDetailResponse {
  title: string;
  subtitle?: string;
  fields: AdminDetailField[];
  sections: AdminDetailSection[];
  /** Actions usable from the detail panel, e.g. replying to a ticket. */
  actions?: Array<{ key: string; label: string; tone?: 'default' | 'danger'; confirm?: string }>;
}

export function formatDateValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTimeValue(value: unknown) {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(cents: unknown, currency = 'USD') {
  const amount = Number(cents ?? 0);
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount / 100);
}

const STATUS_TONES: Record<string, string> = {
  active: 'success',
  connected: 'success',
  completed: 'success',
  delivered: 'success',
  paid: 'success',
  resolved: 'success',
  succeeded: 'success',
  interested: 'success',
  excellent: 'success',
  verified: 'success',
  trialing: 'info',
  scheduled: 'info',
  processing: 'info',
  in_progress: 'info',
  open: 'info',
  queued: 'info',
  syncing: 'info',
  waiting: 'warning',
  paused: 'warning',
  past_due: 'warning',
  fair: 'warning',
  warmup: 'warning',
  unsubscribed: 'warning',
  failed: 'danger',
  error: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  bounced: 'danger',
  complained: 'danger',
  poor: 'danger',
  suspended: 'danger',
  urgent: 'danger',
  high: 'warning',
  deleted: 'danger',
  draft: 'muted',
  archived: 'muted',
  disconnected: 'muted',
  unknown: 'muted',
};

export function statusTone(status: unknown): string {
  return STATUS_TONES[String(status ?? '').toLowerCase()] ?? 'muted';
}

export function humanize(value: unknown) {
  const text = String(value ?? '').replace(/[_-]+/g, ' ').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}
