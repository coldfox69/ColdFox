import { z } from 'zod';

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .transform((v) => v.toLowerCase())
  .refine((v) => EMAIL_RE.test(v), { message: 'Enter a valid email address' });

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Password is too long')
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
    message: 'Include upper case, lower case and a number',
  });

export const LEAD_STATUSES = [
  'new', 'contacted', 'replied', 'interested', 'not_interested', 'bounced', 'unsubscribed', 'archived',
] as const;
export const leadStatusSchema = z.enum(LEAD_STATUSES);

/**
 * Status values allowed by the database (see supabase/migrations). They are the
 * finite set used to build exact per-status breakdowns with count queries
 * instead of pulling whole columns into memory.
 */
export const CAMPAIGN_STATUSES = [
  'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled',
] as const;
export const MAILBOX_STATUSES = [
  'connected', 'error', 'syncing', 'disconnected',
] as const;
export const JOB_STATUSES = [
  'queued', 'processing', 'completed', 'failed', 'cancelled',
] as const;
export const TICKET_STATUSES = [
  'open', 'in_progress', 'waiting', 'resolved', 'closed',
] as const;
export const EXECUTION_STATUSES = [
  'running', 'waiting', 'completed', 'failed', 'stopped', 'cancelled',
] as const;

export const leadInputSchema = z.object({
  first_name: z.string().trim().max(80).optional().nullable(),
  last_name: z.string().trim().max(80).optional().nullable(),
  email: emailSchema,
  company_name: z.string().trim().max(160).optional().nullable(),
  job_title: z.string().trim().max(160).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  linkedin_url: z.string().trim().url('Enter a valid URL').max(300).optional().nullable().or(z.literal('')),
  website: z.string().trim().max(300).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  status: leadStatusSchema.default('new'),
  source: z.string().trim().max(80).default('manual'),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  custom_data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  next_follow_up_at: z.string().datetime().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  /** Leads can only enter a workspace through a named lead list. */
  lead_list_id: z.string().uuid().optional().nullable(),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

export const leadUpdateSchema = leadInputSchema.partial().extend({
  email: emailSchema.optional(),
});

/**
 * Shared pagination parameters for list endpoints.
 * `page` is 1-based, `pageSize` defaults to 50 rows and is capped at 200 so a
 * single request can never pull an unbounded result set.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const leadListQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
  status: z.union([leadStatusSchema, z.literal('all')]).optional().default('all'),
  tag: z.string().trim().max(40).optional(),
  page: paginationSchema.shape.page,
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25),
  sort: z.enum(['created_at', 'name', 'company_name', 'last_contacted_at']).optional().default('created_at'),
  dir: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const templateVariantSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body_text: z.string().trim().min(1).max(50000),
});
export const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(300),
  body_text: z.string().trim().min(1).max(50000),
  category: z.string().trim().max(60).default('General'),
  tags: z.array(z.string().trim().max(40)).max(10).default([]),
  is_shared: z.boolean().default(false),
  /** 'single' (one subject/body) or 'group' (rotatable A/B variants). */
  mode: z.enum(['single', 'group']).default('single'),
  /** Full variant set for group templates; order defines the variant ids. */
  variants: z.array(templateVariantSchema).min(1).max(10).optional(),
  /** When true, the send engine AI-personalizes each recipient before sending. */
  ai_personalization: z.boolean().default(false),
});
export const templateUpdateSchema = templateInputSchema.partial();

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  mailbox_id: z.string().uuid().optional().nullable(),
  template_id: z.string().uuid().optional().nullable(),
  timezone: z.string().trim().max(64).default('UTC'),
  daily_limit: z.coerce.number().int().min(1).max(2000).default(100),
  lead_ids: z.array(z.string().uuid()).max(10000).default([]),
  /** Prepare recipients from a lead list instead of ad-hoc lead ids. */
  lead_list_id: z.string().uuid().optional().nullable(),
  /** Explicit exclusions applied on top of the list (e.g. filtered out in preview). */
  exclude_lead_ids: z.array(z.string().uuid()).max(10000).default([]),
  subject: z.string().trim().min(1).max(300).optional(),
  body: z.string().trim().min(1).max(50000).optional(),
  follow_up_days: z.coerce.number().int().min(0).max(60).optional(),
  send_window_start: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  send_window_end: z.string().regex(/^\d{2}:\d{2}$/).default('17:00'),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]),
  stop_on_reply: z.boolean().default(true),
  /** Random pause between two sends, used to spread load instead of bursting. */
  interval_min_seconds: z.coerce.number().int().min(1).max(3600).default(30),
  interval_max_seconds: z.coerce.number().int().min(1).max(3600).default(70),
  ai_personalization: z.boolean().default(false),
});
export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const campaignLaunchSchema = z.object({
  mode: z.enum(['now', 'schedule']),
  send_at: z.string().datetime().optional(),
});

export const smtpMailboxSchema = z.object({
  email_address: emailSchema,
  display_name: z.string().trim().max(120).optional(),
  provider: z.literal('smtp'),
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean().default(true),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(500),
  daily_limit: z.coerce.number().int().min(1).max(2000).default(100),
  imap_host: z.string().trim().max(255).optional(),
  imap_port: z.coerce.number().int().min(1).max(65535).optional(),
});

export const mailboxUpdateSchema = z.object({
  daily_limit: z.coerce.number().int().min(1).max(2000).optional(),
  warmup_enabled: z.boolean().optional(),
  display_name: z.string().trim().max(120).optional(),
  is_default: z.boolean().optional(),
});

export const aiEmailRequestSchema = z.object({
  mode: z.enum(['generate', 'rewrite', 'optimize', 'subjects', 'follow_up']),
  prompt: z.string().trim().min(3).max(4000),
  tone: z.enum(['professional', 'friendly', 'direct', 'consultative', 'formal']).default('professional'),
  subject: z.string().trim().max(300).optional(),
  body: z.string().trim().max(20000).optional(),
  /** Stream the answer token by token instead of waiting for the full reply. */
  stream: z.boolean().optional().default(false),
  lead: z
    .object({
      first_name: z.string().max(80).optional(),
      last_name: z.string().max(80).optional(),
      company: z.string().max(160).optional(),
      job_title: z.string().max(160).optional(),
      industry: z.string().max(120).optional(),
      website: z.string().max(300).optional(),
      notes: z.string().max(1000).optional(),
    })
    .optional(),
  sender: z.object({ name: z.string().max(120), company: z.string().max(160).optional() }).optional(),
  context: z.string().trim().max(2000).optional(),
});

export const columnAnalysisSchema = z.object({
  headers: z.array(z.string().max(200)).min(1).max(60),
  sampleRows: z.array(z.array(z.union([z.string(), z.number(), z.null()])).max(60)).max(8),
});

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  category_key: z.string().trim().max(60).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

export const supportMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const supportAskSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  ticket_id: z.string().uuid().optional(),
});

export const suppressionInputSchema = z.object({
  email: emailSchema,
  reason_key: z.enum(['unsubscribed', 'hard_bounce', 'complaint', 'manual', 'invalid_address', 'global_block']).default('manual'),
  notes: z.string().trim().max(1000).optional(),
});

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
});

export const settingsSchema = z.object({
  full_name: z.string().trim().min(1).max(120).optional(),
  job_title: z.string().trim().max(120).optional().nullable(),
  department: z.string().trim().max(120).optional().nullable(),
  timezone: z.string().trim().max(64).optional(),
  organization_name: z.string().trim().min(1).max(120).optional(),
  website: z.string().trim().max(300).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
  company_size: z.string().trim().max(60).optional().nullable(),
});

export const onboardingSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  job_title: z.string().trim().min(1).max(120),
  department: z.string().trim().max(120).optional().default(''),
  company_name: z.string().trim().min(2).max(120),
  website: z.string().trim().max(300).optional().default(''),
  industry: z.string().trim().min(1).max(120),
  company_size: z.string().trim().min(1).max(60),
  intended_usage: z.string().trim().max(120).optional().default(''),
  expected_sending_volume: z.string().trim().max(120).optional().default(''),
  outreach_experience: z.string().trim().max(120).optional().default(''),
});

export const domainInputSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .transform((v) => v.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .refine((v) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v), { message: 'Enter a valid domain, e.g. acme.com' }),
  dkim_selector: z.string().trim().max(80).optional(),
});

export const importConfirmSchema = z.object({
  leads: z.array(leadInputSchema).min(1).max(10000),
  filename: z.string().max(255).optional(),
});
