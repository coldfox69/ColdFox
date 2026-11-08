// ColdFox Mock Data — for UI demonstration only

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'interested' | 'not-interested' | 'bounced' | 'unsubscribed';
export type MailboxStatus = 'connected' | 'error' | 'syncing' | 'disconnected';
export type TicketStatus = 'open' | 'in-progress' | 'resolved' | 'closed';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  leadsCount: number;
  emailsSent: number;
  replies: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  createdAt: string;
  scheduledAt?: string;
  mailbox: string;
}

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  jobTitle: string;
  status: LeadStatus;
  tags: string[];
  source: string;
  lastContacted?: string;
  nextFollowUp?: string;
  industry?: string;
  website?: string;
  phone?: string;
  linkedIn?: string;
  notes?: string;
  createdAt: string;
}

export interface Mailbox {
  id: string;
  email: string;
  provider: 'gmail' | 'outlook' | 'smtp';
  status: MailboxStatus;
  dailyLimit: number;
  sentToday: number;
  lastSync: string;
  warmupEnabled: boolean;
  reputation: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface Template {
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

export interface ConversationThread {
  id: string;
  leadName: string;
  leadEmail: string;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  campaign: string;
  status: 'inbox' | 'replied' | 'archived';
  messages: Message[];
}

export interface Message {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  isOutbound: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'pending';
  joinedAt: string;
  lastLogin: string;
  campaignsCount: number;
  emailsSent: number;
  org: string;
}

// === CAMPAIGNS ===
export const campaigns: Campaign[] = [
  { id: 'c1', name: 'Q4 SaaS Outreach', description: 'Targeting SaaS founders for year-end deals', status: 'active', leadsCount: 1240, emailsSent: 890, replies: 67, openRate: 42.3, replyRate: 7.5, bounceRate: 1.2, createdAt: '2026-10-01', mailbox: 'alex@coldfox.io' },
  { id: 'c2', name: 'Agency Growth Push', description: 'Digital agencies seeking automation tools', status: 'active', leadsCount: 560, emailsSent: 420, replies: 38, openRate: 38.7, replyRate: 9.0, bounceRate: 0.8, createdAt: '2026-10-15', mailbox: 'outreach@coldfox.io' },
  { id: 'c3', name: 'E-commerce Re-engage', description: 'Re-engage past trial users from e-commerce sector', status: 'paused', leadsCount: 320, emailsSent: 310, replies: 18, openRate: 29.1, replyRate: 5.8, bounceRate: 2.1, createdAt: '2026-09-20', mailbox: 'alex@coldfox.io' },
  { id: 'c4', name: 'Enterprise Fintech Wave', description: 'Senior decision makers in fintech', status: 'scheduled', leadsCount: 890, emailsSent: 0, replies: 0, openRate: 0, replyRate: 0, bounceRate: 0, createdAt: '2026-10-28', scheduledAt: '2026-11-10', mailbox: 'sales@coldfox.io' },
  { id: 'c5', name: 'SMB Healthcare Pilot', description: 'Small healthcare businesses pilot campaign', status: 'draft', leadsCount: 150, emailsSent: 0, replies: 0, openRate: 0, replyRate: 0, bounceRate: 0, createdAt: '2026-11-01', mailbox: 'alex@coldfox.io' },
  { id: 'c6', name: 'Tech Startup Series', description: 'Early-stage startups series A and B', status: 'completed', leadsCount: 2100, emailsSent: 2100, replies: 189, openRate: 44.6, replyRate: 9.0, bounceRate: 1.5, createdAt: '2026-08-01', mailbox: 'outreach@coldfox.io' },
  { id: 'c7', name: 'HR Tech Decision Makers', description: 'HR directors and CHROs in mid-size companies', status: 'active', leadsCount: 780, emailsSent: 520, replies: 45, openRate: 36.2, replyRate: 8.7, bounceRate: 1.1, createdAt: '2026-10-22', mailbox: 'sales@coldfox.io' },
  { id: 'c8', name: 'Marketing Agency Blast', description: 'Creative and performance marketing agencies', status: 'paused', leadsCount: 430, emailsSent: 280, replies: 22, openRate: 31.5, replyRate: 7.9, bounceRate: 1.8, createdAt: '2026-09-10', mailbox: 'outreach@coldfox.io' },
];

// === LEADS ===
export const leads: Lead[] = [
  { id: 'l1', firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@techflow.io', company: 'TechFlow', jobTitle: 'VP of Sales', status: 'replied', tags: ['saas', 'warm'], source: 'CSV Import', lastContacted: '2026-11-06', nextFollowUp: '2026-11-09', industry: 'SaaS', website: 'techflow.io', createdAt: '2026-10-01' },
  { id: 'l2', firstName: 'Marcus', lastName: 'Rivera', email: 'm.rivera@growthlab.com', company: 'GrowthLab', jobTitle: 'CEO', status: 'interested', tags: ['agency', 'hot'], source: 'Manual', lastContacted: '2026-11-05', nextFollowUp: '2026-11-08', industry: 'Agency', website: 'growthlab.com', createdAt: '2026-10-05' },
  { id: 'l3', firstName: 'Priya', lastName: 'Patel', email: 'priya@nexusfinance.com', company: 'Nexus Finance', jobTitle: 'Head of Operations', status: 'contacted', tags: ['fintech'], source: 'CSV Import', lastContacted: '2026-11-04', industry: 'Fintech', website: 'nexusfinance.com', createdAt: '2026-10-08' },
  { id: 'l4', firstName: 'James', lastName: 'O\'Brien', email: 'james@healthtrack.io', company: 'HealthTrack', jobTitle: 'CTO', status: 'new', tags: ['healthtech'], source: 'CSV Import', industry: 'Healthcare', website: 'healthtrack.io', createdAt: '2026-10-12' },
  { id: 'l5', firstName: 'Emily', lastName: 'Watson', email: 'ewatson@brandcraft.co', company: 'BrandCraft', jobTitle: 'Marketing Director', status: 'replied', tags: ['agency', 'warm'], source: 'Manual', lastContacted: '2026-11-03', nextFollowUp: '2026-11-10', industry: 'Marketing', website: 'brandcraft.co', createdAt: '2026-10-15' },
  { id: 'l6', firstName: 'Daniel', lastName: 'Kim', email: 'd.kim@scalex.com', company: 'ScaleX', jobTitle: 'Founder', status: 'not-interested', tags: ['startup'], source: 'CSV Import', lastContacted: '2026-10-28', industry: 'SaaS', website: 'scalex.com', createdAt: '2026-10-16' },
  { id: 'l7', firstName: 'Natasha', lastName: 'Brown', email: 'n.brown@retailpro.net', company: 'RetailPro', jobTitle: 'Sales Manager', status: 'bounced', tags: ['retail'], source: 'CSV Import', industry: 'Retail', createdAt: '2026-10-18' },
  { id: 'l8', firstName: 'Alex', lastName: 'Thompson', email: 'alex@datawise.ai', company: 'DataWise AI', jobTitle: 'Head of Growth', status: 'interested', tags: ['ai', 'saas', 'hot'], source: 'Manual', lastContacted: '2026-11-07', nextFollowUp: '2026-11-09', industry: 'AI/ML', website: 'datawise.ai', createdAt: '2026-10-20' },
  { id: 'l9', firstName: 'Olivia', lastName: 'Martinez', email: 'olivia@cloudops.io', company: 'CloudOps', jobTitle: 'COO', status: 'contacted', tags: ['cloud', 'enterprise'], source: 'CSV Import', lastContacted: '2026-11-02', industry: 'Cloud Infrastructure', website: 'cloudops.io', createdAt: '2026-10-22' },
  { id: 'l10', firstName: 'Ryan', lastName: 'Foster', email: 'rfoster@legalpulse.com', company: 'LegalPulse', jobTitle: 'Partner', status: 'new', tags: ['legal', 'cold'], source: 'CSV Import', industry: 'Legal Tech', website: 'legalpulse.com', createdAt: '2026-10-25' },
];

// === MAILBOXES ===
export const mailboxes: Mailbox[] = [
  { id: 'm1', email: 'alex@coldfox.io', provider: 'gmail', status: 'connected', dailyLimit: 150, sentToday: 87, lastSync: '2 mins ago', warmupEnabled: true, reputation: 'excellent' },
  { id: 'm2', email: 'outreach@coldfox.io', provider: 'gmail', status: 'connected', dailyLimit: 100, sentToday: 62, lastSync: '5 mins ago', warmupEnabled: true, reputation: 'good' },
  { id: 'm3', email: 'sales@coldfox.io', provider: 'outlook', status: 'connected', dailyLimit: 200, sentToday: 110, lastSync: '1 min ago', warmupEnabled: false, reputation: 'good' },
  { id: 'm4', email: 'noreply@coldfox.io', provider: 'smtp', status: 'error', dailyLimit: 500, sentToday: 0, lastSync: '3 hours ago', warmupEnabled: false, reputation: 'fair' },
];

// === TEMPLATES ===
export const templates: Template[] = [
  { id: 't1', name: 'SaaS Cold Intro', subject: 'Quick question about {{company}}\'s sales process', body: 'Hi {{first_name}},\n\nI noticed {{company}} is scaling its sales team. We help companies like yours automate outreach and book more meetings...\n\nWould a 15-min call make sense?', category: 'Cold Outreach', tags: ['saas', 'intro'], createdAt: '2026-09-01', updatedAt: '2026-10-15', isShared: true, usageCount: 342 },
  { id: 't2', name: 'Agency Partnership', subject: 'Collaboration opportunity for {{company}}', body: 'Hey {{first_name}},\n\nLove what {{company}} is doing in the {{industry}} space. We work with agencies to help their clients get better email results...\n\nOpen to a quick chat?', category: 'Partnership', tags: ['agency', 'partnership'], createdAt: '2026-09-15', updatedAt: '2026-11-01', isShared: true, usageCount: 187 },
  { id: 't3', name: 'Follow-up #1', subject: 'Re: Quick question about {{company}}', body: 'Hi {{first_name}},\n\nJust wanted to follow up on my previous note. Did you get a chance to review it?', category: 'Follow-up', tags: ['follow-up'], createdAt: '2026-09-20', updatedAt: '2026-09-20', isShared: false, usageCount: 891 },
  { id: 't4', name: 'Value-Add Check-in', subject: 'Thought this might help {{company}}', body: 'Hi {{first_name}},\n\nI came across this [resource] and immediately thought of {{company}}. Given your focus on {{industry}}, this could be useful...', category: 'Nurture', tags: ['nurture', 'value'], createdAt: '2026-10-01', updatedAt: '2026-10-01', isShared: false, usageCount: 124 },
  { id: 't5', name: 'Re-engagement', subject: 'Still interested in solving [problem] at {{company}}?', body: 'Hi {{first_name}},\n\nIt\'s been a while since we connected. I wanted to check if the timing is better now for a conversation about...', category: 'Re-engagement', tags: ['re-engage', 'warm'], createdAt: '2026-10-10', updatedAt: '2026-11-02', isShared: true, usageCount: 56 },
];

// === CONVERSATIONS ===
export const conversations: ConversationThread[] = [
  {
    id: 'conv1', leadName: 'Sarah Chen', leadEmail: 'sarah.chen@techflow.io', subject: 'Re: Quick question about TechFlow\'s sales process', lastMessage: 'Hi, thanks for reaching out! We\'d actually love to hear more about this.', lastMessageAt: '2026-11-07 14:32', unread: true, campaign: 'Q4 SaaS Outreach', status: 'inbox',
    messages: [
      { id: 'msg1', from: 'alex@coldfox.io', to: 'sarah.chen@techflow.io', subject: 'Quick question about TechFlow\'s sales process', body: 'Hi Sarah,\n\nI noticed TechFlow is scaling its sales team. We help companies like yours automate outreach and book more meetings without the manual work.\n\nWould a 15-min call make sense this week?\n\nBest,\nAlex', sentAt: '2026-11-05 09:00', isOutbound: true },
      { id: 'msg2', from: 'sarah.chen@techflow.io', to: 'alex@coldfox.io', subject: 'Re: Quick question about TechFlow\'s sales process', body: 'Hi, thanks for reaching out! We\'d actually love to hear more about this. Can we schedule something for next week?', sentAt: '2026-11-07 14:32', isOutbound: false },
    ]
  },
  {
    id: 'conv2', leadName: 'Marcus Rivera', leadEmail: 'm.rivera@growthlab.com', subject: 'Collaboration opportunity for GrowthLab', lastMessage: 'This sounds interesting. What does your pricing look like?', lastMessageAt: '2026-11-06 11:15', unread: true, campaign: 'Agency Growth Push', status: 'inbox',
    messages: [
      { id: 'msg3', from: 'outreach@coldfox.io', to: 'm.rivera@growthlab.com', subject: 'Collaboration opportunity for GrowthLab', body: 'Hey Marcus,\n\nLove what GrowthLab is doing in the agency space. We work with agencies to help their clients get better email results...\n\nOpen to a quick chat?', sentAt: '2026-11-04 10:00', isOutbound: true },
      { id: 'msg4', from: 'm.rivera@growthlab.com', to: 'outreach@coldfox.io', subject: 'Re: Collaboration opportunity for GrowthLab', body: 'This sounds interesting. What does your pricing look like?', sentAt: '2026-11-06 11:15', isOutbound: false },
    ]
  },
  {
    id: 'conv3', leadName: 'Alex Thompson', leadEmail: 'alex@datawise.ai', subject: 'AI-powered outreach for DataWise AI', lastMessage: 'Can you send me more information about your AI features?', lastMessageAt: '2026-11-07 16:45', unread: false, campaign: 'Tech Startup Series', status: 'replied',
    messages: [
      { id: 'msg5', from: 'alex@coldfox.io', to: 'alex@datawise.ai', subject: 'AI-powered outreach for DataWise AI', body: 'Hi Alex,\n\nGiven DataWise AI\'s focus on machine learning, I thought you\'d appreciate how we use AI for outreach personalization...', sentAt: '2026-11-06 09:30', isOutbound: true },
      { id: 'msg6', from: 'alex@datawise.ai', to: 'alex@coldfox.io', subject: 'Re: AI-powered outreach for DataWise AI', body: 'Can you send me more information about your AI features?', sentAt: '2026-11-07 16:45', isOutbound: false },
    ]
  },
];

// === ADMIN USERS ===
export const adminUsers: AdminUser[] = [
  { id: 'u1', name: 'Jennifer Walsh', email: 'j.walsh@techflow.io', plan: 'pro', status: 'active', joinedAt: '2026-08-15', lastLogin: '2026-11-07', campaignsCount: 12, emailsSent: 8420, org: 'TechFlow' },
  { id: 'u2', name: 'Robert Chang', email: 'rchang@growthlab.com', plan: 'enterprise', status: 'active', joinedAt: '2026-07-01', lastLogin: '2026-11-07', campaignsCount: 34, emailsSent: 42100, org: 'GrowthLab' },
  { id: 'u3', name: 'Amelia Stone', email: 'amelia@nexusfinance.com', plan: 'starter', status: 'active', joinedAt: '2026-10-01', lastLogin: '2026-11-06', campaignsCount: 3, emailsSent: 840, org: 'Nexus Finance' },
  { id: 'u4', name: 'Tom Bradley', email: 'tbradley@brandcraft.co', plan: 'free', status: 'active', joinedAt: '2026-11-01', lastLogin: '2026-11-05', campaignsCount: 1, emailsSent: 50, org: 'BrandCraft' },
  { id: 'u5', name: 'Zara Okafor', email: 'z.okafor@cloudops.io', plan: 'pro', status: 'suspended', joinedAt: '2026-09-12', lastLogin: '2026-10-30', campaignsCount: 8, emailsSent: 5600, org: 'CloudOps' },
  { id: 'u6', name: 'Liam Nolan', email: 'l.nolan@scalex.com', plan: 'starter', status: 'active', joinedAt: '2026-10-20', lastLogin: '2026-11-04', campaignsCount: 2, emailsSent: 310, org: 'ScaleX' },
];

// === ANALYTICS DATA ===
export const analyticsData = {
  overview: {
    totalLeads: 12480,
    activeLeads: 8920,
    totalCampaigns: 24,
    activeCampaigns: 4,
    emailsSent: 89420,
    delivered: 87230,
    replied: 6740,
    bounced: 1890,
    unsubscribed: 342,
    sendingHealth: 94,
  },
  chartData: [
    { date: 'Oct 6', sent: 1200, replied: 89, bounced: 14 },
    { date: 'Oct 13', sent: 1450, replied: 112, bounced: 18 },
    { date: 'Oct 20', sent: 1890, replied: 145, bounced: 22 },
    { date: 'Oct 27', sent: 2100, replied: 167, bounced: 31 },
    { date: 'Nov 3', sent: 2340, replied: 198, bounced: 28 },
    { date: 'Nov 7', sent: 1980, replied: 156, bounced: 19 },
  ],
  mailboxPerformance: [
    { name: 'alex@coldfox.io', sent: 34200, delivered: 33800, replied: 2890 },
    { name: 'outreach@coldfox.io', sent: 28100, delivered: 27600, replied: 2120 },
    { name: 'sales@coldfox.io', sent: 27120, delivered: 25830, replied: 1730 },
  ],
};

// === PLAN DATA ===
export const plans = [
  { id: 'free', name: 'Free', price: 0, period: 'month', leads: 100, emails: 500, mailboxes: 1, aiCredits: 10, features: ['1 mailbox', '100 leads', '500 emails/mo', 'Basic templates', 'Community support'] },
  { id: 'starter', name: 'Starter', price: 49, period: 'month', leads: 2500, emails: 10000, mailboxes: 3, aiCredits: 100, features: ['3 mailboxes', '2,500 leads', '10,000 emails/mo', 'AI email writer', 'Unified inbox', 'Email support'] },
  { id: 'pro', name: 'Pro', price: 99, period: 'month', leads: 10000, emails: 50000, mailboxes: 10, aiCredits: 500, features: ['10 mailboxes', '10,000 leads', '50,000 emails/mo', 'Advanced AI', 'Analytics & reporting', 'Automations', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 249, period: 'month', leads: -1, emails: -1, mailboxes: -1, aiCredits: -1, features: ['Unlimited everything', 'Custom AI models', 'Dedicated CSM', 'SLA guarantee', 'Custom integrations', 'SSO/SAML'] },
];

// === SUPPRESSION ===
export const suppressionList = [
  { id: 's1', email: 'unsubscribe@example.com', reason: 'unsubscribed', date: '2026-11-01', source: 'Campaign: Q4 SaaS Outreach' },
  { id: 's2', email: 'bounce@oldcompany.net', reason: 'hard-bounce', date: '2026-10-28', source: 'Campaign: Tech Startup Series' },
  { id: 's3', email: 'noemail@testdomain.io', reason: 'hard-bounce', date: '2026-10-25', source: 'Campaign: Agency Growth Push' },
  { id: 's4', email: 'complaint@sensitive.com', reason: 'complaint', date: '2026-10-20', source: 'Campaign: E-commerce Re-engage' },
  { id: 's5', email: 'donotcontact@corp.com', reason: 'manual', date: '2026-10-15', source: 'Manual entry' },
];

// === TICKETS ===
export const supportTickets = [
  { id: 'tk1', subject: 'Gmail connection failing after OAuth', status: 'open' as TicketStatus, priority: 'high', createdAt: '2026-11-07', updatedAt: '2026-11-07', messages: 2 },
  { id: 'tk2', subject: 'How do I set up DKIM for my domain?', status: 'resolved' as TicketStatus, priority: 'medium', createdAt: '2026-11-05', updatedAt: '2026-11-06', messages: 5 },
  { id: 'tk3', subject: 'CSV import not recognizing email column', status: 'in-progress' as TicketStatus, priority: 'medium', createdAt: '2026-11-04', updatedAt: '2026-11-07', messages: 3 },
  { id: 'tk4', subject: 'Billing question about pro plan', status: 'closed' as TicketStatus, priority: 'low', createdAt: '2026-10-30', updatedAt: '2026-11-01', messages: 4 },
];
