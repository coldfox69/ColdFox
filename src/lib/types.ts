export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface ActiveOrganization {
  id: string;
  name: string;
  slug: string;
  planKey: string;
  planName: string;
  role: OrgRole;
  timezone: string;
}

export interface ShellNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company_name: string | null;
  job_title: string | null;
  status: string;
  source: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  linkedin_url: string | null;
  tags: string[];
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
}

export interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  total_leads: number;
  emails_sent: number;
  replies: number;
  bounces: number;
  unsubscribes: number;
  created_at: string;
  launch_at: string | null;
  mailbox: { id: string; email_address: string } | null;
}

export interface MailboxRow {
  id: string;
  email_address: string;
  display_name: string | null;
  provider: 'gmail' | 'outlook' | 'smtp';
  status: 'connected' | 'error' | 'syncing' | 'disconnected';
  daily_limit: number;
  sent_today: number;
  warmup_enabled: boolean;
  reputation: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  last_sync_at: string | null;
  last_error: string | null;
}

export interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  category: string;
  tags: string[];
  usage_count: number;
  current_version: number;
  updated_at: string;
  created_at: string;
}
