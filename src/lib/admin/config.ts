/**
 * Admin console module configuration.
 * Client-safe: imported by the table, forms and page components. No server
 * code, secrets or service-role clients live here.
 */

export type AdminColumnType =
  | 'text'
  | 'email'
  | 'date'
  | 'datetime'
  | 'bool'
  | 'status'
  | 'number'
  | 'money'
  | 'currency'
  | 'micros'
  | 'json'
  | 'truncate';

export interface AdminColumnConfig {
  key: string;
  label: string;
  type?: AdminColumnType;
  sortable?: boolean;
  /** Hidden below the large breakpoint to keep the table readable. */
  secondary?: boolean;
  width?: string;
}

export interface AdminOption {
  value: string;
  label: string;
}

export interface AdminFormField {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'email' | 'number' | 'select' | 'checkbox' | 'datetime' | 'json' | 'password';
  options?: AdminOption[];
  /** Resolve select options from a facet returned by the list endpoint. */
  optionsFromFacet?: string;
  /** Use the module's secondary dataset (for example the role catalog). */
  optionsFromSecondary?: boolean;
  required?: boolean;
  help?: string;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  fullWidth?: boolean;
}

export interface AdminActionConfig {
  key: string;
  label: string;
  action: string;
  tone?: 'default' | 'danger';
  confirm?: string;
  /** Extra values collected before the action runs. */
  fields?: AdminFormField[];
  /** Hide the action when it does not apply to the current row. */
  visibleWhen?: (row: Record<string, unknown>) => boolean;
}

export interface AdminFilterConfig {
  param: 'status' | 'filter' | 'dir';
  label: string;
  options?: AdminOption[];
  facet?: string;
  allLabel?: string;
}

export interface AdminModuleConfig {
  module: string;
  title: string;
  description: string;
  columns: AdminColumnConfig[];
  searchPlaceholder?: string;
  filters?: AdminFilterConfig[];
  createLabel?: string;
  createAction?: string;
  createFields?: AdminFormField[];
  rowActions?: AdminActionConfig[];
  bulkActions?: AdminActionConfig[];
  defaultSort?: string;
  defaultDir?: 'asc' | 'desc';
  exportable?: boolean;
  /** Label for the secondary table returned by the API. */
  secondaryTitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Summary cards shown above the table. */
  summaryKeys?: Array<{ key: string; label: string; type?: 'number' | 'money' | 'currency' | 'micros' }>;
  readOnly?: boolean;
  /** Some log modules have no per-record detail payload. */
  disableDetail?: boolean;
}

const STATUS_ACTIVE = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'unconfirmed', label: 'Unconfirmed' },
];

const LEAD_STATUS_OPTIONS: AdminOption[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'archived', label: 'Archived' },
];

const CAMPAIGN_STATUS_OPTIONS: AdminOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const MAILBOX_STATUS_OPTIONS: AdminOption[] = [
  { value: 'connected', label: 'Connected' },
  { value: 'syncing', label: 'Syncing' },
  { value: 'error', label: 'Error' },
  { value: 'disconnected', label: 'Disconnected' },
];

const SUBSCRIPTION_STATUS_OPTIONS: AdminOption[] = [
  { value: 'trialing', label: 'Trialing' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'paused', label: 'Paused' },
  { value: 'canceled', label: 'Canceled' },
];

const INVOICE_STATUS_OPTIONS: AdminOption[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Draft' },
  { value: 'void', label: 'Void' },
  { value: 'uncollectible', label: 'Uncollectible' },
];

const TICKET_STATUS_OPTIONS: AdminOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS: AdminOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const EVENT_TYPE_OPTIONS: AdminOption[] = [
  'queued', 'processing', 'accepted', 'delivered', 'bounced', 'complained',
  'opened', 'clicked', 'replied', 'unsubscribed', 'failed',
].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }));

const JOB_TYPE_OPTIONS = [
  'campaign_send', 'inbox_sync', 'automation_run', 'deliverability_check', 'cleanup',
].map((value) => ({ value, label: value.replace(/_/g, ' ') }));

const LEVEL_OPTIONS = ['debug', 'info', 'warn', 'error', 'fatal'].map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

const EDIT_USER_FIELDS: AdminFormField[] = [
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'full_name', label: 'Full name' },
  { key: 'job_title', label: 'Job title' },
  { key: 'phone', label: 'Phone' },
  { key: 'timezone', label: 'Timezone', placeholder: 'UTC' },
];

const EDIT_ORG_FIELDS: AdminFormField[] = [
  { key: 'name', label: 'Organization name', required: true },
  { key: 'slug', label: 'Slug', help: 'Used in workspace URLs.' },
  { key: 'website', label: 'Website' },
  { key: 'industry', label: 'Industry' },
  { key: 'company_size', label: 'Company size' },
  { key: 'timezone', label: 'Timezone', placeholder: 'UTC' },
  { key: 'admin_notes', label: 'Internal notes', type: 'textarea', fullWidth: true },
];

const LEAD_FIELDS: AdminFormField[] = [
  { key: 'organization_id', label: 'Organization', type: 'select', optionsFromFacet: 'organization_id', required: true },
  { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'company_name', label: 'Company' },
  { key: 'job_title', label: 'Job title' },
  { key: 'phone', label: 'Phone' },
  { key: 'status', label: 'Status', type: 'select', options: LEAD_STATUS_OPTIONS, defaultValue: 'new' },
  { key: 'source', label: 'Source' },
  { key: 'linkedin_url', label: 'LinkedIn URL', fullWidth: true },
];

const CAMPAIGN_FIELDS: AdminFormField[] = [
  { key: 'organization_id', label: 'Organization', type: 'select', optionsFromFacet: 'organization_id', required: true },
  { key: 'name', label: 'Campaign name', required: true },
  { key: 'daily_limit', label: 'Daily sending limit', type: 'number', defaultValue: 100, help: 'The engine still applies the mailbox and plan limits.' },
  { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
];

const MAILBOX_EDIT_FIELDS: AdminFormField[] = [
  { key: 'display_name', label: 'Display name' },
  { key: 'daily_limit', label: 'Daily limit', type: 'number' },
  { key: 'warmup_enabled', label: 'Warmup enabled', type: 'checkbox' },
  { key: 'admin_notes', label: 'Internal notes', type: 'textarea', fullWidth: true },
];

const PLAN_FIELDS: AdminFormField[] = [
  { key: 'key', label: 'Plan key', required: true, help: 'Lower case identifier, for example growth.' },
  { key: 'name', label: 'Plan name', required: true },
  { key: 'price_monthly', label: 'Monthly price (USD)', type: 'number', defaultValue: 0 },
  { key: 'currency', label: 'Currency', defaultValue: 'USD' },
  { key: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
  { key: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
  { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
  { key: 'limits', label: 'Limits (JSON)', type: 'json', fullWidth: true, placeholder: '{"leads": 5000}' },
  { key: 'features', label: 'Features (JSON array)', type: 'json', fullWidth: true, placeholder: '["AI writer", "Unified inbox"]' },
];

const ANNOUNCEMENT_FIELDS: AdminFormField[] = [
  { key: 'title', label: 'Title', required: true },
  { key: 'variant', label: 'Variant', type: 'select', options: [
    { value: 'info', label: 'Info' },
    { value: 'warning', label: 'Warning' },
    { value: 'success', label: 'Success' },
  ], defaultValue: 'info' },
  { key: 'starts_at', label: 'Starts at', type: 'datetime' },
  { key: 'ends_at', label: 'Ends at', type: 'datetime' },
  { key: 'is_active', label: 'Active', type: 'checkbox', defaultValue: true },
  { key: 'body', label: 'Body', type: 'textarea', fullWidth: true, required: true },
];

const FLAG_FIELDS: AdminFormField[] = [
  { key: 'key', label: 'Flag key', required: true },
  { key: 'description', label: 'Description' },
  { key: 'enabled', label: 'Enabled', type: 'checkbox' },
  { key: 'rollout', label: 'Rollout rules (JSON)', type: 'json', fullWidth: true, placeholder: '{"percent": 25}' },
];

const SETTING_FIELDS: AdminFormField[] = [
  { key: 'key', label: 'Setting key', required: true },
  { key: 'is_public', label: 'Public', type: 'checkbox' },
  { key: 'value', label: 'Value (JSON)', type: 'json', fullWidth: true, required: true, placeholder: '{}' },
];

export const ADMIN_MODULE_CONFIG: Record<string, AdminModuleConfig> = {
  users: {
    module: 'users',
    title: 'User management',
    description: 'Search every platform account, review workspace membership and control account access.',
    searchPlaceholder: 'Search by email, name or job title',
    columns: [
      { key: 'email', label: 'Email', type: 'email', sortable: true },
      { key: 'full_name', label: 'Name' },
      { key: 'created_at', label: 'Registered', type: 'datetime', sortable: true },
      { key: 'last_sign_in_at', label: 'Last sign in', type: 'datetime', sortable: true, secondary: true },
      { key: 'confirmed', label: 'Confirmed', type: 'bool', secondary: true },
      { key: 'terminated', label: 'Account', type: 'status' },
    ],
    filters: [{ param: 'status', label: 'Account status', options: STATUS_ACTIVE }],
    summaryKeys: [
      { key: 'total', label: 'Accounts' },
      { key: 'active30d', label: 'Signed in, 30 days' },
      { key: 'new30d', label: 'New, 30 days' },
      { key: 'suspended', label: 'Suspended' },
    ],
    rowActions: [
      { key: 'edit', label: 'Edit profile', action: 'update', fields: EDIT_USER_FIELDS },
      { key: 'suspend', label: 'Suspend account', action: 'suspend', tone: 'danger', confirm: 'Suspend this account? They will be signed out and blocked from signing in.', visibleWhen: (row) => !row.terminated },
      { key: 'activate', label: 'Reactivate account', action: 'activate', visibleWhen: (row) => Boolean(row.terminated) },
      { key: 'delete', label: 'Delete account', action: 'delete', tone: 'danger', confirm: 'Delete this account permanently? This cannot be undone. Users that own a workspace must be handled first.' },
    ],
    bulkActions: [
      { key: 'bulk-suspend', label: 'Suspend selected', action: 'suspend', tone: 'danger', confirm: 'Suspend the selected accounts?' },
      { key: 'bulk-activate', label: 'Reactivate selected', action: 'activate' },
      { key: 'bulk-delete', label: 'Delete selected', action: 'delete', tone: 'danger', confirm: 'Delete the selected accounts permanently?' },
    ],
    defaultSort: 'created_at',
  },

  organizations: {
    module: 'organizations',
    title: 'Organizations',
    description: 'Every workspace, its plan and its health. Suspension here blocks the workspace for all members.',
    searchPlaceholder: 'Search by name, slug or website',
    columns: [
      { key: 'name', label: 'Organization', sortable: true },
      { key: 'plan_name', label: 'Plan', sortable: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sortable: true },
      { key: 'suspended_reason', label: 'Suspension reason', secondary: true },
      { key: 'is_suspended', label: 'Status', type: 'status' },
    ],
    filters: [
      { param: 'status', label: 'Workspace status', options: [
        { value: 'active', label: 'Active' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'deleted', label: 'Deleted' },
      ] },
    ],
    summaryKeys: [
      { key: 'total', label: 'Active workspaces' },
      { key: 'paid', label: 'On paid plans' },
      { key: 'free', label: 'On free plan' },
      { key: 'suspended', label: 'Suspended' },
    ],
    createLabel: 'New organization',
    createAction: 'create',
    createFields: [
      { key: 'name', label: 'Organization name', required: true },
      { key: 'owner_email', label: 'Owner email', type: 'email', required: true, help: 'The owner must already have a ColdFox account.' },
      { key: 'plan_key', label: 'Plan', type: 'select', optionsFromFacet: 'plan_key', required: true },
      { key: 'website', label: 'Website' },
      { key: 'industry', label: 'Industry' },
      { key: 'company_size', label: 'Company size' },
    ],
    rowActions: [
      { key: 'edit', label: 'Edit organization', action: 'update', fields: EDIT_ORG_FIELDS },
      { key: 'plan', label: 'Change plan', action: 'change_plan', fields: [
        { key: 'plan_key', label: 'Plan', type: 'select', optionsFromFacet: 'plan_key', required: true },
      ] },
      { key: 'suspend', label: 'Suspend workspace', action: 'suspend', tone: 'danger', fields: [
        { key: 'reason', label: 'Suspension reason', type: 'textarea', fullWidth: true, required: true },
      ], confirm: 'Suspend this workspace? All members lose access immediately.', visibleWhen: (row) => !row.is_suspended },
      { key: 'restore', label: 'Restore workspace', action: 'restore', visibleWhen: (row) => Boolean(row.is_suspended) },
      { key: 'delete', label: 'Delete workspace', action: 'delete', tone: 'danger', confirm: 'Delete this workspace? It is soft deleted and all members lose access.' },
    ],
    bulkActions: [
      { key: 'bulk-suspend', label: 'Suspend selected', action: 'suspend', tone: 'danger', fields: [
        { key: 'reason', label: 'Suspension reason', type: 'textarea', fullWidth: true, required: true },
      ], confirm: 'Suspend the selected workspaces?' },
      { key: 'bulk-restore', label: 'Restore selected', action: 'restore' },
      { key: 'bulk-delete', label: 'Delete selected', action: 'delete', tone: 'danger', confirm: 'Delete the selected workspaces?' },
    ],
    defaultSort: 'created_at',
  },

  leads: {
    module: 'leads',
    title: 'Lead management',
    description: 'Cross-workspace lead records. Edit, retag or remove leads without sending anything on the customer behalf.',
    searchPlaceholder: 'Search by email, name or company',
    columns: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'first_name', label: 'First name', secondary: true },
      { key: 'last_name', label: 'Last name', secondary: true },
      { key: 'company_name', label: 'Company' },
      { key: 'organization_name', label: 'Workspace', secondary: true },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'last_contacted_at', label: 'Last contacted', type: 'datetime', sortable: true, secondary: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sortable: true },
    ],
    filters: [
      { param: 'status', label: 'Lead status', options: LEAD_STATUS_OPTIONS },
      { param: 'filter', label: 'Workspace', facet: 'organization_id' },
    ],
    summaryKeys: [
      { key: 'total', label: 'Leads' },
      { key: 'new', label: 'New' },
      { key: 'contacted', label: 'Contacted' },
      { key: 'replied', label: 'Replied' },
    ],
    createLabel: 'New lead',
    createAction: 'create',
    createFields: LEAD_FIELDS,
    rowActions: [
      { key: 'edit', label: 'Edit lead', action: 'update', fields: LEAD_FIELDS.filter((field) => field.key !== 'organization_id') },
      { key: 'status', label: 'Change status', action: 'set_status', fields: [
        { key: 'status', label: 'Status', type: 'select', options: LEAD_STATUS_OPTIONS, required: true },
      ] },
      { key: 'restore', label: 'Restore lead', action: 'restore', visibleWhen: (row) => Boolean(row.deleted_at) },
      { key: 'delete', label: 'Delete lead', action: 'delete', tone: 'danger', confirm: 'Delete this lead? It is soft deleted and can be restored later.' },
    ],
    bulkActions: [
      { key: 'bulk-status', label: 'Change status', action: 'set_status', fields: [
        { key: 'status', label: 'Status', type: 'select', options: LEAD_STATUS_OPTIONS, required: true },
      ] },
      { key: 'bulk-delete', label: 'Delete selected', action: 'delete', tone: 'danger', confirm: 'Delete the selected leads?' },
    ],
    defaultSort: 'created_at',
  },

  campaigns: {
    module: 'campaigns',
    title: 'Campaigns',
    description: 'Monitor and control customer campaigns. Pausing and archiving stops the sending engine before any further message leaves.',
    searchPlaceholder: 'Search campaigns by name',
    columns: [
      { key: 'name', label: 'Campaign', sortable: true },
      { key: 'organization_name', label: 'Workspace', secondary: true },
      { key: 'status', label: 'Status', type: 'status', sortable: true },
      { key: 'total_leads', label: 'Leads', type: 'number' },
      { key: 'emails_sent', label: 'Sent', type: 'number', sortable: true },
      { key: 'replies', label: 'Replies', type: 'number', sortable: true },
      { key: 'bounces', label: 'Bounces', type: 'number', secondary: true },
      { key: 'created_at', label: 'Created', type: 'datetime', sortable: true },
    ],
    filters: [
      { param: 'status', label: 'Campaign status', options: CAMPAIGN_STATUS_OPTIONS },
      { param: 'filter', label: 'Workspace', facet: 'organization_id' },
    ],
    summaryKeys: [
      { key: 'total', label: 'Campaigns' },
      { key: 'active', label: 'Active' },
      { key: 'paused', label: 'Paused' },
      { key: 'completed', label: 'Completed' },
    ],
    createLabel: 'New campaign',
    createAction: 'create',
    createFields: CAMPAIGN_FIELDS,
    rowActions: [
      { key: 'pause', label: 'Pause campaign', action: 'pause', visibleWhen: (row) => row.status === 'active' || row.status === 'scheduled' },
      { key: 'resume', label: 'Resume campaign', action: 'resume', visibleWhen: (row) => row.status === 'paused' && !row.archived_at },
      { key: 'cancel', label: 'Cancel campaign', action: 'cancel', tone: 'danger', confirm: 'Cancel this campaign? Queued sends are cancelled.', visibleWhen: (row) => ['draft', 'scheduled', 'active', 'paused'].includes(String(row.status)) },
      { key: 'archive', label: 'Archive campaign', action: 'archive', tone: 'danger', confirm: 'Archive this campaign? Sending stops and it leaves the active list.', visibleWhen: (row) => !row.archived_at },
      { key: 'restore', label: 'Restore campaign', action: 'restore', visibleWhen: (row) => Boolean(row.archived_at) },
      { key: 'edit', label: 'Edit campaign', action: 'update', fields: [
        { key: 'name', label: 'Campaign name', required: true },
        { key: 'daily_limit', label: 'Daily limit', type: 'number' },
        { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
        { key: 'admin_notes', label: 'Internal notes', type: 'textarea', fullWidth: true },
      ] },
      { key: 'delete', label: 'Delete campaign', action: 'delete', tone: 'danger', confirm: 'Delete this campaign? Only draft, cancelled or completed campaigns can be deleted.', visibleWhen: (row) => ['draft', 'cancelled', 'completed'].includes(String(row.status)) },
    ],
    bulkActions: [
      { key: 'bulk-pause', label: 'Pause selected', action: 'pause' },
      { key: 'bulk-resume', label: 'Resume selected', action: 'resume' },
      { key: 'bulk-archive', label: 'Archive selected', action: 'archive', tone: 'danger', confirm: 'Archive the selected campaigns? Sending stops for all of them.' },
    ],
    defaultSort: 'created_at',
  },

  mailboxes: {
    module: 'mailboxes',
    title: 'Mailbox management',
    description: 'Sending identities and their health. Credentials are never read or shown. Enable, disable or remove stored credentials only.',
    searchPlaceholder: 'Search by email address',
    columns: [
      { key: 'email_address', label: 'Mailbox', type: 'email', sortable: true },
      { key: 'organization_name', label: 'Workspace', secondary: true },
      { key: 'provider', label: 'Provider' },
      { key: 'status', label: 'Status', type: 'status', sortable: true },
      { key: 'sent_today', label: 'Sent today', type: 'number', sortable: true },
      { key: 'daily_limit', label: 'Daily limit', type: 'number' },
      { key: 'reputation', label: 'Reputation', type: 'status', secondary: true },
      { key: 'last_sync_at', label: 'Last sync', type: 'datetime', secondary: true },
    ],
    filters: [
      { param: 'status', label: 'Mailbox status', options: MAILBOX_STATUS_OPTIONS },
      { param: 'filter', label: 'Workspace', facet: 'organization_id' },
    ],
    summaryKeys: [
      { key: 'total', label: 'Mailboxes' },
      { key: 'connected', label: 'Connected' },
      { key: 'error', label: 'In error' },
      { key: 'disconnected', label: 'Disconnected' },
    ],
    rowActions: [
      { key: 'edit', label: 'Edit limits', action: 'update', fields: MAILBOX_EDIT_FIELDS },
      { key: 'enable', label: 'Enable mailbox', action: 'enable', visibleWhen: (row) => row.status !== 'connected' },
      { key: 'disable', label: 'Disable mailbox', action: 'disable', confirm: 'Disable this mailbox? It stops sending until enabled again.', visibleWhen: (row) => row.status === 'connected' },
      { key: 'disconnect', label: 'Remove credentials', action: 'disconnect', tone: 'danger', confirm: 'Delete the stored credentials? The mailbox row stays, but it cannot send until the customer reconnects it.' },
      { key: 'delete', label: 'Delete mailbox', action: 'delete', tone: 'danger', confirm: 'Delete this mailbox and its stored credentials?' },
    ],
    bulkActions: [
      { key: 'bulk-enable', label: 'Enable selected', action: 'enable' },
      { key: 'bulk-disable', label: 'Disable selected', action: 'disable' },
      { key: 'bulk-disconnect', label: 'Remove credentials', action: 'disconnect', tone: 'danger', confirm: 'Remove stored credentials from the selected mailboxes?' },
    ],
    defaultSort: 'created_at',
  },

  subscriptions: {
    module: 'subscriptions',
    title: 'Subscriptions',
    description: 'Plan state for every workspace. Changes here update the workspace plan key and are written to the audit log.',
    searchPlaceholder: 'Search by workspace name',
    columns: [
      { key: 'organization_name', label: 'Workspace' },
      { key: 'plan_name', label: 'Plan' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'price_monthly', label: 'Monthly', type: 'currency' },
      { key: 'current_period_end', label: 'Period end', type: 'date' },
      { key: 'cancel_at_period_end', label: 'Cancels', type: 'bool', secondary: true },
      { key: 'created_at', label: 'Created', type: 'datetime', secondary: true },
    ],
    filters: [
      { param: 'status', label: 'Subscription status', options: SUBSCRIPTION_STATUS_OPTIONS },
      { param: 'filter', label: 'Plan', facet: 'plan_key' },
    ],
    summaryKeys: [
      { key: 'total', label: 'Subscriptions' },
      { key: 'active', label: 'Active' },
      { key: 'trialing', label: 'Trialing' },
      { key: 'mrr', label: 'MRR', type: 'currency' },
    ],
    rowActions: [
      { key: 'edit', label: 'Edit subscription', action: 'update', fields: [
        { key: 'plan_key', label: 'Plan', type: 'select', optionsFromFacet: 'plan_key', required: true },
        { key: 'status', label: 'Status', type: 'select', options: SUBSCRIPTION_STATUS_OPTIONS, required: true },
        { key: 'current_period_end', label: 'Period end', type: 'datetime' },
        { key: 'trial_ends_at', label: 'Trial ends', type: 'datetime' },
        { key: 'cancel_at_period_end', label: 'Cancel at period end', type: 'checkbox' },
      ] },
    ],
    defaultSort: 'created_at',
  },

  plans: {
    module: 'plans',
    title: 'Plans and pricing',
    description: 'The plan catalog used by onboarding and checkout. Prices are monthly in the plan currency.',
    searchPlaceholder: 'Search plans',
    columns: [
      { key: 'key', label: 'Key' },
      { key: 'name', label: 'Plan' },
      { key: 'price_monthly', label: 'Monthly', type: 'currency' },
      { key: 'currency', label: 'Currency' },
      { key: 'is_active', label: 'Active', type: 'bool' },
      { key: 'sort_order', label: 'Order', type: 'number', secondary: true },
      { key: 'updated_at', label: 'Updated', type: 'datetime', secondary: true },
    ],
    summaryKeys: [
      { key: 'total', label: 'Plans' },
      { key: 'active', label: 'Active' },
      { key: 'paid', label: 'Paid tiers' },
    ],
    createLabel: 'New plan',
    createAction: 'create',
    createFields: PLAN_FIELDS,
    rowActions: [
      { key: 'edit', label: 'Edit plan', action: 'update', fields: PLAN_FIELDS },
      { key: 'delete', label: 'Delete plan', action: 'delete', tone: 'danger', confirm: 'Delete this plan? If it has subscribers it is deactivated instead.' },
    ],
    defaultSort: 'sort_order',
    defaultDir: 'asc',
  },

  billing: {
    module: 'billing',
    title: 'Billing and payments',
    description: 'Invoice records recorded by the billing provider. Admin actions only change administrative status. No payment is ever marked paid here.',
    searchPlaceholder: 'Search by workspace',
    columns: [
      { key: 'organization_name', label: 'Workspace' },
      { key: 'provider_invoice_id', label: 'Invoice', secondary: true },
      { key: 'amount_cents', label: 'Amount', type: 'money' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'issued_at', label: 'Issued', type: 'date' },
      { key: 'paid_at', label: 'Paid', type: 'date', secondary: true },
      { key: 'created_at', label: 'Created', type: 'datetime', secondary: true },
    ],
    filters: [{ param: 'status', label: 'Invoice status', options: INVOICE_STATUS_OPTIONS }],
    summaryKeys: [
      { key: 'total', label: 'Invoices' },
      { key: 'paid', label: 'Paid' },
      { key: 'open', label: 'Open' },
      { key: 'paidAmountCents', label: 'Paid total', type: 'money' },
    ],
    rowActions: [
      { key: 'void', label: 'Void invoice', action: 'void_invoice', tone: 'danger', confirm: 'Void this invoice? This changes the administrative status only.', visibleWhen: (row) => row.status !== 'paid' && row.status !== 'void' },
    ],
    defaultSort: 'created_at',
  },

  tickets: {
    module: 'tickets',
    title: 'Support tickets',
    description: 'Customer conversations with priority, assignment and internal notes. Replies are recorded as admin messages.',
    searchPlaceholder: 'Search by subject or description',
    columns: [
      { key: 'subject', label: 'Subject' },
      { key: 'organization_name', label: 'Workspace', secondary: true },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'priority', label: 'Priority', type: 'status' },
      { key: 'assigned_to', label: 'Assigned', secondary: true },
      { key: 'created_at', label: 'Created', type: 'datetime' },
      { key: 'updated_at', label: 'Updated', type: 'datetime', secondary: true },
    ],
    filters: [
      { param: 'status', label: 'Ticket status', options: TICKET_STATUS_OPTIONS },
      { param: 'filter', label: 'Priority', options: PRIORITY_OPTIONS },
    ],
    summaryKeys: [
      { key: 'total', label: 'Tickets' },
      { key: 'open', label: 'Open' },
      { key: 'waiting', label: 'Waiting' },
      { key: 'resolved', label: 'Resolved' },
    ],
    createLabel: 'New ticket',
    createAction: 'create',
    createFields: [
      { key: 'organization_id', label: 'Organization', type: 'select', optionsFromFacet: 'organization_id', required: true },
      { key: 'subject', label: 'Subject', required: true },
      { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS, defaultValue: 'normal' },
      { key: 'category_key', label: 'Category', type: 'select', optionsFromFacet: 'category_key' },
      { key: 'description', label: 'Description', type: 'textarea', fullWidth: true, required: true },
    ],
    rowActions: [
      { key: 'reply', label: 'Reply to customer', action: 'reply', fields: [
        { key: 'message', label: 'Reply', type: 'textarea', fullWidth: true, required: true },
      ] },
      { key: 'note', label: 'Add internal note', action: 'internal_note', fields: [
        { key: 'message', label: 'Internal note', type: 'textarea', fullWidth: true, required: true },
      ] },
      { key: 'edit', label: 'Update ticket', action: 'update', fields: [
        { key: 'status', label: 'Status', type: 'select', options: TICKET_STATUS_OPTIONS },
        { key: 'priority', label: 'Priority', type: 'select', options: PRIORITY_OPTIONS },
        { key: 'category_key', label: 'Category', type: 'select', optionsFromFacet: 'category_key' },
        { key: 'assigned_to', label: 'Assigned admin user ID' },
      ] },
      { key: 'resolve', label: 'Mark resolved', action: 'resolve', visibleWhen: (row) => row.status !== 'resolved' },
      { key: 'reopen', label: 'Reopen ticket', action: 'reopen', visibleWhen: (row) => row.status === 'resolved' },
      { key: 'delete', label: 'Delete ticket', action: 'delete', tone: 'danger', confirm: 'Delete this ticket and its conversation?' },
    ],
    defaultSort: 'created_at',
  },

  announcements: {
    module: 'announcements',
    title: 'Announcements',
    description: 'Banner messages shown inside the product. Schedule a start and end, or switch them on and off.',
    searchPlaceholder: 'Search announcements',
    columns: [
      { key: 'title', label: 'Title' },
      { key: 'variant', label: 'Variant', type: 'status' },
      { key: 'starts_at', label: 'Starts', type: 'datetime', secondary: true },
      { key: 'ends_at', label: 'Ends', type: 'datetime', secondary: true },
      { key: 'is_active', label: 'Active', type: 'bool' },
      { key: 'created_at', label: 'Created', type: 'datetime', secondary: true },
    ],
    summaryKeys: [
      { key: 'total', label: 'Announcements' },
      { key: 'active', label: 'Active' },
    ],
    createLabel: 'New announcement',
    createAction: 'create',
    createFields: ANNOUNCEMENT_FIELDS,
    rowActions: [
      { key: 'edit', label: 'Edit announcement', action: 'update', fields: ANNOUNCEMENT_FIELDS },
      { key: 'activate', label: 'Publish', action: 'activate', visibleWhen: (row) => !row.is_active },
      { key: 'deactivate', label: 'Unpublish', action: 'deactivate', visibleWhen: (row) => Boolean(row.is_active) },
      { key: 'delete', label: 'Delete announcement', action: 'delete', tone: 'danger', confirm: 'Delete this announcement?' },
    ],
    bulkActions: [
      { key: 'bulk-activate', label: 'Publish selected', action: 'activate' },
      { key: 'bulk-deactivate', label: 'Unpublish selected', action: 'deactivate' },
    ],
  },

  'ai-usage': {
    module: 'ai-usage',
    title: 'AI management',
    description: 'AI generation records, token volume and model usage. Every number comes from the usage ledger.',
    columns: [
      { key: 'kind', label: 'Kind', type: 'status' },
      { key: 'organization_name', label: 'Workspace', secondary: true },
      { key: 'tokens', label: 'Tokens', type: 'number' },
      { key: 'cost_micros', label: 'Cost', type: 'micros' },
      { key: 'created_at', label: 'When', type: 'datetime' },
    ],
    filters: [{ param: 'filter', label: 'Kind', facet: 'kind' }],
    summaryKeys: [
      { key: 'requests30d', label: 'Requests, 30 days' },
      { key: 'tokens30d', label: 'Tokens, 30 days' },
      { key: 'costMicros30d', label: 'Cost, 30 days', type: 'micros' },
      { key: 'records', label: 'Records' },
    ],
    readOnly: true,
    disableDetail: true,
    defaultSort: 'created_at',
  },

  'ai-agents': {
    module: 'ai-agents',
    title: 'AI agents',
    description: 'The agents users can run from their workspace. Publish an agent to make it visible, and connect its API so it can do real work.',
    searchPlaceholder: 'Search agents',
    columns: [
      { key: 'name', label: 'Agent' },
      { key: 'category', label: 'Category', secondary: true },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'agent_type', label: 'Type', type: 'status', secondary: true },
      { key: 'api_configured', label: 'API', type: 'bool' },
      { key: 'supports_outreach', label: 'Outreach', type: 'bool', secondary: true },
      { key: 'field_count', label: 'Fields', type: 'number', secondary: true },
      { key: 'updated_at', label: 'Updated', type: 'datetime', secondary: true },
    ],
    filters: [
      { param: 'status', label: 'Status', options: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'disabled', label: 'Disabled' },
      ] },
    ],
    summaryKeys: [
      { key: 'total', label: 'Agents' },
      { key: 'published', label: 'Published' },
      { key: 'connected', label: 'API connected' },
      { key: 'runs', label: 'Runs, 30 days' },
    ],
    createLabel: 'New agent',
    createAction: 'create',
    createFields: [
      { key: 'name', label: 'Name', required: true, help: 'For example: Shopify lead generation.' },
      { key: 'slug', label: 'Slug', help: 'Used in the URL. Left empty it is generated from the name.' },
      { key: 'description', label: 'Description', type: 'textarea', fullWidth: true, help: 'What the agent does, shown to the user.' },
      { key: 'purpose', label: 'Purpose', type: 'textarea', fullWidth: true, help: 'The outcome the agent produces.' },
      { key: 'icon', label: 'Icon', help: 'A lucide icon name, for example shopping-bag.', defaultValue: 'bot' },
      { key: 'category', label: 'Category', defaultValue: 'general' },
      { key: 'agent_type', label: 'Type', type: 'select', options: [
        { value: 'external', label: 'External API' },
        { value: 'builtin', label: 'Built in' },
      ], defaultValue: 'external' },
      { key: 'input_schema', label: 'Input fields (JSON)', type: 'json', fullWidth: true, help: 'A list of field definitions. The full editor is on the agent page.' },
      { key: 'api_config', label: 'API configuration (JSON)', type: 'json', fullWidth: true, help: 'Base URL, path and auth style of the agent API.' },
      { key: 'supports_outreach', label: 'Can hand results to email outreach', type: 'checkbox' },
      { key: 'sort_order', label: 'Order', type: 'number', defaultValue: 0 },
    ],
    rowActions: [
      { key: 'edit', label: 'Edit agent', action: 'update', fields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'slug', label: 'Slug' },
        { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
        { key: 'purpose', label: 'Purpose', type: 'textarea', fullWidth: true },
        { key: 'icon', label: 'Icon' },
        { key: 'category', label: 'Category' },
        { key: 'input_schema', label: 'Input fields (JSON)', type: 'json', fullWidth: true },
        { key: 'api_config', label: 'API configuration (JSON)', type: 'json', fullWidth: true },
        { key: 'supports_outreach', label: 'Can hand results to email outreach', type: 'checkbox' },
        { key: 'sort_order', label: 'Order', type: 'number' },
      ] },
      { key: 'publish', label: 'Publish to users', action: 'publish', visibleWhen: (row) => row.status !== 'published' },
      { key: 'unpublish', label: 'Unpublish', action: 'unpublish', visibleWhen: (row) => row.status === 'published' },
      { key: 'disable', label: 'Disable', action: 'disable', visibleWhen: (row) => row.status !== 'disabled' },
      { key: 'enable', label: 'Enable', action: 'enable', visibleWhen: (row) => row.status === 'disabled' },
      { key: 'api-key', label: 'Set API key', action: 'set_api_key', fields: [
        { key: 'api_key', label: 'API key', type: 'password', required: true, help: 'Stored encrypted. It is never shown again.' },
      ] },
      { key: 'remove-key', label: 'Remove API key', action: 'remove_api_key', tone: 'danger', confirm: 'Remove the stored API key of this agent?' },
      { key: 'delete', label: 'Delete agent', action: 'delete', tone: 'danger', confirm: 'Delete this agent? Its runs stay in the history, but the agent disappears for users.' },
    ],
    defaultSort: 'sort_order',
    defaultDir: 'asc',
  },

  'api-usage': {
    module: 'api-usage',
    title: 'API monitoring',
    description: 'Rate limit buckets recorded by the API. Shows request pressure per subject and window.',
    columns: [
      { key: 'key', label: 'Bucket key' },
      { key: 'count', label: 'Requests', type: 'number' },
      { key: 'window_start', label: 'Window start', type: 'datetime' },
    ],
    summaryKeys: [
      { key: 'buckets', label: 'Buckets' },
      { key: 'requests', label: 'Requests' },
    ],
    readOnly: true,
    disableDetail: true,
  },

  'feature-flags': {
    module: 'feature-flags',
    title: 'Feature flags',
    description: 'Server-side release switches. Changes take effect on the next request.',
    searchPlaceholder: 'Search flag keys',
    columns: [
      { key: 'key', label: 'Flag' },
      { key: 'description', label: 'Description', secondary: true },
      { key: 'enabled', label: 'Enabled', type: 'bool' },
      { key: 'updated_at', label: 'Updated', type: 'datetime' },
    ],
    summaryKeys: [
      { key: 'total', label: 'Flags' },
      { key: 'enabled', label: 'Enabled' },
    ],
    createLabel: 'New flag',
    createAction: 'create',
    createFields: FLAG_FIELDS,
    rowActions: [
      { key: 'edit', label: 'Edit flag', action: 'update', fields: FLAG_FIELDS },
      { key: 'delete', label: 'Delete flag', action: 'delete', tone: 'danger', confirm: 'Delete this feature flag?' },
    ],
  },

  settings: {
    module: 'settings',
    title: 'Global settings',
    description: 'Key value settings used by the platform. Values are JSON and are validated before saving.',
    searchPlaceholder: 'Search setting keys',
    columns: [
      { key: 'key', label: 'Key' },
      { key: 'value', label: 'Value', type: 'json' },
      { key: 'is_public', label: 'Public', type: 'bool' },
      { key: 'updated_at', label: 'Updated', type: 'datetime', secondary: true },
    ],
    summaryKeys: [{ key: 'total', label: 'Settings' }],
    createLabel: 'New setting',
    createAction: 'create',
    createFields: SETTING_FIELDS,
    rowActions: [
      { key: 'edit', label: 'Edit setting', action: 'update', fields: SETTING_FIELDS },
      { key: 'delete', label: 'Delete setting', action: 'delete', tone: 'danger', confirm: 'Delete this setting?' },
    ],
  },

  jobs: {
    module: 'jobs',
    title: 'Background jobs',
    description: 'Queued, running and failed work. Retry failed jobs or cancel stuck ones.',
    columns: [
      { key: 'job_type', label: 'Job type' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'attempts', label: 'Attempts', type: 'number', secondary: true },
      { key: 'run_at', label: 'Run at', type: 'datetime' },
      { key: 'last_error', label: 'Last error', type: 'truncate', secondary: true },
      { key: 'created_at', label: 'Created', type: 'datetime', secondary: true },
    ],
    filters: [
      { param: 'status', label: 'Job status', options: [
        { value: 'queued', label: 'Queued' },
        { value: 'processing', label: 'Processing' },
        { value: 'completed', label: 'Completed' },
        { value: 'failed', label: 'Failed' },
        { value: 'cancelled', label: 'Cancelled' },
      ] },
      { param: 'filter', label: 'Job type', options: JOB_TYPE_OPTIONS },
    ],
    summaryKeys: [
      { key: 'total', label: 'Jobs' },
      { key: 'queued', label: 'Queued' },
      { key: 'failed', label: 'Failed' },
      { key: 'processing', label: 'Processing' },
    ],
    rowActions: [
      { key: 'retry', label: 'Retry job', action: 'retry', visibleWhen: (row) => row.status === 'failed' || row.status === 'cancelled' },
      { key: 'cancel', label: 'Cancel job', action: 'cancel', tone: 'danger', confirm: 'Cancel this job?', visibleWhen: (row) => row.status === 'queued' || row.status === 'processing' },
      { key: 'delete', label: 'Delete job', action: 'delete', tone: 'danger', confirm: 'Delete this job record?' },
    ],
    bulkActions: [
      { key: 'bulk-retry', label: 'Retry selected', action: 'retry' },
      { key: 'bulk-cancel', label: 'Cancel selected', action: 'cancel', tone: 'danger', confirm: 'Cancel the selected jobs?' },
      { key: 'bulk-delete', label: 'Delete selected', action: 'delete', tone: 'danger', confirm: 'Delete the selected job records?' },
    ],
    defaultSort: 'created_at',
  },

  errors: {
    module: 'errors',
    title: 'Error logs',
    description: 'Server errors captured by the API and workers. Resolve what is handled and reopen anything that returns.',
    searchPlaceholder: 'Search messages and stacks',
    columns: [
      { key: 'level', label: 'Level', type: 'status' },
      { key: 'message', label: 'Message', type: 'truncate' },
      { key: 'resolved_at', label: 'Resolved', type: 'datetime' },
      { key: 'created_at', label: 'When', type: 'datetime' },
    ],
    filters: [
      { param: 'status', label: 'State', options: [
        { value: 'unresolved', label: 'Unresolved' },
        { value: 'resolved', label: 'Resolved' },
      ] },
      { param: 'filter', label: 'Level', options: LEVEL_OPTIONS },
    ],
    summaryKeys: [
      { key: 'total', label: 'Entries' },
      { key: 'last24h', label: 'Last 24 hours' },
      { key: 'unresolved', label: 'Unresolved' },
    ],
    rowActions: [
      { key: 'resolve', label: 'Mark resolved', action: 'resolve', visibleWhen: (row) => !row.resolved_at },
      { key: 'reopen', label: 'Mark unresolved', action: 'reopen_error', visibleWhen: (row) => Boolean(row.resolved_at) },
      { key: 'delete', label: 'Delete entry', action: 'delete', tone: 'danger', confirm: 'Delete this error log entry?' },
    ],
    bulkActions: [
      { key: 'bulk-resolve', label: 'Resolve selected', action: 'resolve' },
      { key: 'bulk-reopen', label: 'Reopen selected', action: 'reopen_error' },
      { key: 'bulk-delete', label: 'Delete selected', action: 'delete', tone: 'danger', confirm: 'Delete the selected error entries?' },
    ],
    defaultSort: 'created_at',
  },

  audit: {
    module: 'audit',
    title: 'Audit log',
    description: 'Every administrative change with actor, entity, request metadata and values before and after.',
    searchPlaceholder: 'Search action, actor or entity',
    columns: [
      { key: 'created_at', label: 'When', type: 'datetime' },
      { key: 'action', label: 'Action' },
      { key: 'actor_email', label: 'Actor', type: 'email', secondary: true },
      { key: 'entity_type', label: 'Entity' },
      { key: 'entity_id', label: 'Entity ID', type: 'truncate', secondary: true },
      { key: 'organization_name', label: 'Workspace', secondary: true },
    ],
    filters: [
      { param: 'status', label: 'Entity type', options: [
        { value: 'user', label: 'User' },
        { value: 'organization', label: 'Organization' },
        { value: 'lead', label: 'Lead' },
        { value: 'campaign', label: 'Campaign' },
        { value: 'mailbox', label: 'Mailbox' },
        { value: 'subscription', label: 'Subscription' },
        { value: 'support_ticket', label: 'Support ticket' },
        { value: 'platform_admin', label: 'Admin account' },
      ] },
      { param: 'filter', label: 'Action', facet: 'action' },
    ],
    summaryKeys: [
      { key: 'last24h', label: 'Changes, 24 hours' },
      { key: 'distinctActions', label: 'Distinct actions' },
    ],
    readOnly: true,
    defaultSort: 'created_at',
  },

  roles: {
    module: 'roles',
    title: 'Admin accounts',
    description: 'Who can enter the owner console and what their role allows. Every grant and removal is audited.',
    columns: [
      { key: 'email', label: 'Administrator', type: 'email' },
      { key: 'role', label: 'Role', type: 'status' },
      { key: 'granted_at', label: 'Granted', type: 'datetime' },
      { key: 'notes', label: 'Notes', type: 'truncate', secondary: true },
    ],
    summaryKeys: [
      { key: 'admins', label: 'Administrators' },
      { key: 'roles', label: 'Roles' },
      { key: 'permissions', label: 'Permissions' },
    ],
    createLabel: 'Add administrator',
    createAction: 'assign',
    createFields: [
      { key: 'email', label: 'Registered user email', type: 'email', required: true },
      { key: 'role', label: 'Role', type: 'select', optionsFromSecondary: true, required: true },
      { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
    ],
    rowActions: [
      { key: 'edit', label: 'Change role', action: 'update_admin', fields: [
        { key: 'role', label: 'Role', type: 'select', optionsFromSecondary: true, required: true },
        { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
      ] },
      { key: 'remove', label: 'Remove administrator', action: 'remove_admin', tone: 'danger', confirm: 'Remove this administrator? They lose console access immediately.' },
    ],
    secondaryTitle: 'Role catalog',
    defaultSort: 'granted_at',
    disableDetail: true,
  },

  webhooks: {
    module: 'webhooks',
    title: 'Webhooks',
    description: 'Inbound provider events and their signature state. Mark an event processed only after handling it.',
    searchPlaceholder: 'Search provider or event ID',
    columns: [
      { key: 'provider', label: 'Provider' },
      { key: 'event_id', label: 'Event ID', type: 'truncate' },
      { key: 'signature_valid', label: 'Signature', type: 'bool' },
      { key: 'processed_at', label: 'Processed', type: 'datetime' },
      { key: 'error', label: 'Error', type: 'truncate', secondary: true },
      { key: 'received_at', label: 'Received', type: 'datetime' },
    ],
    filters: [{ param: 'status', label: 'State', options: [
      { value: 'pending', label: 'Pending' },
      { value: 'processed', label: 'Processed' },
    ] }],
    summaryKeys: [
      { key: 'total', label: 'Events' },
      { key: 'valid', label: 'Valid signature' },
      { key: 'invalid', label: 'Invalid signature' },
      { key: 'processed', label: 'Processed' },
    ],
    rowActions: [
      { key: 'process', label: 'Mark processed', action: 'mark_processed', visibleWhen: (row) => !row.processed_at },
      { key: 'delete', label: 'Delete event', action: 'delete', tone: 'danger', confirm: 'Delete this webhook event record?' },
    ],
    bulkActions: [
      { key: 'bulk-process', label: 'Mark processed', action: 'mark_processed' },
      { key: 'bulk-delete', label: 'Delete selected', action: 'delete', tone: 'danger', confirm: 'Delete the selected webhook events?' },
    ],
    defaultSort: 'received_at',
  },

  abuse: {
    module: 'abuse',
    title: 'Deliverability',
    description: 'Complaints and bounce records reported by the providers. These feed suppression and sender reputation.',
    columns: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'organization_name', label: 'Workspace', secondary: true },
      { key: 'provider', label: 'Provider' },
      { key: 'reason', label: 'Reason', type: 'truncate' },
      { key: 'occurred_at', label: 'Occurred', type: 'datetime' },
    ],
    summaryKeys: [
      { key: 'complaints', label: 'Complaints' },
      { key: 'bounces', label: 'Bounces' },
    ],
    secondaryTitle: 'Bounce records',
    readOnly: true,
    disableDetail: true,
    defaultSort: 'occurred_at',
  },

  'email-activity': {
    module: 'email-activity',
    title: 'Email activity',
    description: 'The event stream behind sent, delivered, replied, bounced and unsubscribed counts.',
    columns: [
      { key: 'event_type', label: 'Event', type: 'status' },
      { key: 'organization_name', label: 'Workspace', secondary: true },
      { key: 'campaign_id', label: 'Campaign', type: 'truncate', secondary: true },
      { key: 'occurred_at', label: 'When', type: 'datetime' },
    ],
    filters: [{ param: 'status', label: 'Event type', options: EVENT_TYPE_OPTIONS }],
    summaryKeys: [
      { key: 'total', label: 'Events' },
      { key: 'delivered', label: 'Delivered' },
      { key: 'replied', label: 'Replied' },
      { key: 'bounced', label: 'Bounced' },
    ],
    readOnly: true,
    disableDetail: true,
    defaultSort: 'occurred_at',
  },

  integrations: {
    module: 'integrations',
    title: 'Integrations',
    description: 'Which services are configured in this environment. Values are reported from server configuration, never from client input.',
    columns: [
      { key: 'label', label: 'Integration' },
      { key: 'detail', label: 'Purpose', type: 'truncate' },
      { key: 'configured', label: 'Configured', type: 'bool' },
    ],
    summaryKeys: [
      { key: 'total', label: 'Integrations' },
      { key: 'configured', label: 'Configured' },
    ],
    readOnly: true,
    disableDetail: true,
  },
};
