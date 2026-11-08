/**
 * View models shared by server data loaders and the existing Bolt UI views.
 * These mirror the shapes the UI was originally built with (camelCase) while
 * the database uses snake_case. Keeping the mapping here means the design layer
 * never has to know about storage details.
 */

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'not-interested'
  | 'bounced'
  | 'unsubscribed'
  | 'archived';

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
export type MailboxStatus = 'connected' | 'error' | 'syncing' | 'disconnected';
export type MailboxProvider = 'gmail' | 'outlook' | 'smtp';
export type Reputation = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface CampaignVM {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  leadsCount: number;
  emailsSent: number;
  replies: number;
  bounces: number;
  unsubscribes: number;
  replyRate: number;
  bounceRate: number;
  createdAt: string;
  scheduledAt?: string | null;
  mailbox: string;
  mailboxId?: string | null;
  templateId?: string | null;
}

export interface LeadVM {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  status: LeadStatus;
  tags: string[];
  source: string;
  lastContacted?: string | null;
  nextFollowUp?: string | null;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  linkedIn?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface MailboxVM {
  id: string;
  email: string;
  displayName?: string | null;
  provider: MailboxProvider;
  status: MailboxStatus;
  dailyLimit: number;
  sentToday: number;
  lastSync: string;
  warmupEnabled: boolean;
  reputation: Reputation;
  lastError?: string | null;
}

export interface TemplateVM {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isShared: boolean;
  usageCount: number;
}

export interface MessageVM {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  isOutbound: boolean;
}

export interface ConversationThreadVM {
  id: string;
  leadId?: string | null;
  leadName: string;
  leadEmail: string;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  campaign: string;
  status: 'inbox' | 'replied' | 'archived';
  assignedTo?: string | null;
  messages: MessageVM[];
}

export interface OverviewVM {
  totals: {
    totalLeads: number;
    activeCampaigns: number;
    emailsSent: number;
    delivered: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
    sendingHealth: number;
  };
  chartData: { date: string; sent: number; replied: number; bounced: number }[];
  campaigns: CampaignVM[];
  mailboxes: MailboxVM[];
  activity: { text: string; time: string; dot: string }[];
  recommendations: string[];
}

export interface LeadNoteVM {
  id: string;
  body: string;
  createdAt: string;
}

export interface LeadActivityVM {
  id: string;
  type: string;
  description: string;
  at: string;
}

export interface LeadDetailVM {
  lead: LeadVM;
  notes: LeadNoteVM[];
  activities: LeadActivityVM[];
  threads: ConversationThreadVM[];
}

export interface AnalyticsVM {
  totals: {
    totalLeads: number;
    activeCampaigns: number;
    campaigns: number;
    emailsSent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replies: number;
    bounces: number;
    unsubscribes: number;
    bounceRate: number;
    replyRate: number;
    unsubscribeRate: number;
    sendingHealth: number;
  };
  chartData: { date: string; sent: number; replied: number; bounced: number }[];
  campaigns: CampaignVM[];
  mailboxes: MailboxVM[];
  domains: { domain: string; status: string }[];
  recentActivity: { type: string; at: string; lead?: unknown; campaign?: unknown }[];
  eventCounts: Record<string, number>;
}

const LEAD_STATUS_MAP: Record<string, LeadStatus> = {
  new: 'new',
  contacted: 'contacted',
  replied: 'replied',
  interested: 'interested',
  not_interested: 'not-interested',
  'not-interested': 'not-interested',
  bounced: 'bounced',
  unsubscribed: 'unsubscribed',
  archived: 'archived',
};

export function toLeadStatus(value: unknown): LeadStatus {
  return LEAD_STATUS_MAP[String(value)] ?? 'new';
}

export function fromLeadStatus(value: LeadStatus): string {
  return value === 'not-interested' ? 'not_interested' : value;
}

const CAMPAIGN_STATUSES: CampaignStatus[] = ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'];
export function toCampaignStatus(value: unknown): CampaignStatus {
  const s = String(value);
  return (CAMPAIGN_STATUSES as string[]).includes(s) ? (s as CampaignStatus) : 'draft';
}

export function toMailboxStatus(value: unknown): MailboxStatus {
  const s = String(value);
  return s === 'connected' || s === 'syncing' || s === 'error' ? s : 'disconnected';
}

export function toReputation(value: unknown): Reputation {
  const s = String(value);
  return s === 'excellent' || s === 'good' || s === 'fair' || s === 'poor' ? s : 'unknown';
}

export function formatDate(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function formatRelative(value: unknown): string {
  if (!value) return 'Never';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Never';
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function formatDateTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}
