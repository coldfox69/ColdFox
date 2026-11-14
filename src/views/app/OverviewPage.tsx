'use client';

import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  ArrowRight, Check, CheckCircle2, Circle, UploadCloud, Mail, FileText, Megaphone,
  Send, Reply, TrendingUp, AlertTriangle, Sparkles, Clock, Users, Inbox,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { HoverPrefetchLink } from '@/components/shared/HoverPrefetchLink';
import { CampaignStatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import type { OverviewVM } from '@/lib/view-models';

const mailboxDot: Record<string, string> = {
  connected: 'bg-[var(--success)]',
  error: 'bg-[var(--danger)]',
  syncing: 'bg-[var(--warning)]',
  disconnected: 'bg-muted-foreground',
};

const mailboxLabel: Record<string, string> = {
  connected: 'Connected',
  error: 'Needs attention',
  syncing: 'Syncing',
  disconnected: 'Disconnected',
};

function StatCard({ label, value, caption, icon, tone = 'neutral' }: {
  label: string;
  value: string;
  caption?: string;
  icon: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'ai';
}) {
  const toneClass = {
    neutral: 'icon-tile',
    brand: 'icon-tile-brand',
    success: 'icon-tile-success',
    warning: 'icon-tile-warning',
    danger: 'icon-tile-danger',
    ai: 'icon-tile-ai',
  }[tone];
  return (
    <div className="neu-card rounded-[16px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums">{value}</p>
          {caption && <p className="mt-2 text-[12px] text-muted-foreground">{caption}</p>}
        </div>
        <span className={cn('h-9 w-9 shrink-0 items-center justify-center rounded-[10px]', toneClass)}>
          {icon}
        </span>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, action, children, className }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('neu-card min-w-0 rounded-[16px] p-5', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function OverviewPage({ data }: { data: OverviewVM }) {
  const { totals: o, chartData, campaigns, mailboxes, activity, recommendations } = data;
  const setup = data.setup ?? {
    leads: o.totalLeads,
    leadLists: 0,
    templates: 0,
    mailboxes: mailboxes.length,
    connectedMailboxes: mailboxes.filter(m => m.status === 'connected').length,
    campaigns: campaigns.length,
  };
  const bounceRate = o.emailsSent ? (o.bounced / o.emailsSent) * 100 : 0;
  const showOnboarding = setup.campaigns === 0;

  const steps = [
    {
      key: 'leads',
      title: 'Add your leads',
      description: 'Upload a CSV or paste a spreadsheet. ColdFox maps the columns for you.',
      href: '/app/lead-lists#new',
      cta: setup.leads > 0 ? 'Manage leads' : 'Import leads',
      icon: UploadCloud,
      done: setup.leads > 0,
      detail: setup.leads > 0 ? `${setup.leads.toLocaleString()} lead${setup.leads === 1 ? '' : 's'} ready` : 'CSV, TSV, XLSX, or paste',
    },
    {
      key: 'mailbox',
      title: 'Connect a sending mailbox',
      description: 'Gmail, Outlook, or your own SMTP account. This is the address leads will see.',
      href: '/app/mailboxes',
      cta: setup.connectedMailboxes > 0 ? 'Manage mailboxes' : 'Connect mailbox',
      icon: Mail,
      done: setup.connectedMailboxes > 0,
      detail: setup.connectedMailboxes > 0 ? `${setup.connectedMailboxes} connected` : 'Takes about two minutes',
    },
    {
      key: 'template',
      title: 'Write an email template',
      description: 'One reusable message. Use personalization fields or let AI draft it for you.',
      href: '/app/templates',
      cta: setup.templates > 0 ? 'Manage templates' : 'Create template',
      icon: FileText,
      done: setup.templates > 0,
      detail: setup.templates > 0 ? `${setup.templates} template${setup.templates === 1 ? '' : 's'} saved` : 'Write once, reuse everywhere',
    },
    {
      key: 'campaign',
      title: 'Launch your first campaign',
      description: 'Pick a lead list, a template, and a mailbox. Review everything before sending.',
      href: '/app/campaigns/new',
      cta: 'Create campaign',
      icon: Megaphone,
      done: setup.campaigns > 0,
      detail: 'Nothing sends until you confirm',
    },
  ];
  const completed = steps.filter(s => s.done).length;
  const progress = Math.round((completed / steps.length) * 100);

  const attention: { text: string; href: string; cta: string }[] = [];
  if (setup.mailboxes > 0 && setup.connectedMailboxes === 0) {
    attention.push({ text: 'Your sending mailbox is disconnected, so campaigns cannot send.', href: '/app/mailboxes', cta: 'Reconnect' });
  }
  if (setup.campaigns > 0 && setup.mailboxes === 0) {
    attention.push({ text: 'No mailbox is connected. Add one before starting a campaign.', href: '/app/mailboxes', cta: 'Connect mailbox' });
  }
  if (o.emailsSent > 0 && bounceRate > 3) {
    attention.push({ text: `Bounce rate is ${bounceRate.toFixed(1)}%. Verify addresses before the next send.`, href: '/app/leads', cta: 'Review leads' });
  }
  const drafts = campaigns.filter(c => c.status === 'draft').length;
  if (drafts > 0) {
    attention.push({ text: `${drafts} draft campaign${drafts === 1 ? '' : 's'} waiting to be reviewed and launched.`, href: '/app/campaigns', cta: 'Open drafts' });
  }

  if (showOnboarding) {
    return (
      <div>
        <div className="page-band">
          <div className="mx-auto max-w-[1120px] px-6 pb-10 pt-10 lg:px-8 lg:pb-12 lg:pt-12">
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-[12px] font-medium text-muted-foreground',
            )}>
              <Sparkles className="h-3.5 w-3.5" /> First-time setup
            </span>
            <h1 className="mt-4 max-w-2xl text-[30px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[36px]">
              Welcome to ColdFox
            </h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Four short steps take you from an empty workspace to your first outreach campaign.
              You can pause at any point and come back here.
            </p>
            <div className="mt-6 flex max-w-md items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={completed} aria-label="Setup progress">
                <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--dur-slow)] ease-[var(--ease)]" style={{ width: `${progress}%` }} />
              </div>
              <span className="shrink-0 text-[12px] font-medium text-muted-foreground">{completed} of {steps.length} done</span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1120px] space-y-6 px-6 py-8 lg:px-8">
          <div className="grid gap-4 lg:grid-cols-2">
            {steps.map((step, index) => (
              <div key={step.key} className={cn('neu-card flex flex-col rounded-[16px] p-5', step.done && 'border-[var(--cf-success)]/35')}>
                <div className="flex items-start gap-3">
                  <span className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold',
                    step.done ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'icon-tile',
                  )}>
                    {step.done ? <Check className="h-4 w-4" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold text-foreground">{step.title}</h2>
                      {step.done && <span className="text-[11px] font-medium text-[var(--cf-success)]">Done</span>}
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
                    <p className="mt-2 text-[12px] text-muted-foreground">{step.detail}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end border-t border-border pt-3">
                  <HoverPrefetchLink href={step.href} className={cn(
                    'inline-flex items-center gap-1.5 rounded-[9px] px-3 py-2 text-[13px] font-medium transition-colors',
                    step.done
                      ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      : 'bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-105',
                  )}>
                    {step.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </HoverPrefetchLink>
                </div>
              </div>
            ))}
          </div>

          <section className="neu-card rounded-[16px] p-6">
            <h2 className="text-[15px] font-semibold text-foreground">How a campaign works</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              {[
                { icon: Users, title: '1. Choose who', text: 'A lead list is a group of contacts, usually imported from a spreadsheet.' },
                { icon: FileText, title: '2. Choose what', text: 'A template is the email copy. Placeholders such as {{first_name}} personalize it.' },
                { icon: Send, title: '3. Review and send', text: 'You see a preview of real recipients and can pause or stop at any time.' },
              ].map(item => (
                <div key={item.title} className="flex gap-3">
                  <span className="icon-tile h-8 w-8 shrink-0 rounded-[9px]">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-card/70 px-5 py-4">
            <p className="text-[13px] text-muted-foreground">Not sure where something lives? The Support page has short guides and a ticket form.</p>
            <Link href="/app/support" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-foreground hover:underline">
              Open Support <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Overview"
        description="What is happening in your workspace, and what to do next."
        actions={
          <>
            <Link href="/app/lead-lists#new" className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
              Import leads
            </Link>
            <Link href="/app/campaigns/new" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
              <Megaphone className="h-4 w-4" /> New campaign
            </Link>
          </>
        }
      />

      {attention.length > 0 && (
        <div className="mb-4 space-y-2">
          {attention.slice(0, 2).map(item => (
            <div key={item.text} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warning)]" />
              <p className="min-w-0 flex-1 text-[13px] text-foreground">{item.text}</p>
              <Link href={item.href} className="text-[12px] font-semibold text-[var(--cf-warning)] hover:underline">{item.cta}</Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <StatCard label="Active campaigns" value={o.activeCampaigns.toLocaleString()} caption={`${campaigns.length} total in this workspace`} icon={<Megaphone className="h-4 w-4" />} />
        <StatCard label="Emails sent" value={o.emailsSent.toLocaleString()} caption="Accepted by your provider" icon={<Send className="h-4 w-4" />} />
        <StatCard label="Replies" value={o.replied.toLocaleString()} caption={o.emailsSent ? `${((o.replied / o.emailsSent) * 100).toFixed(1)}% reply rate` : 'Recorded in the inbox'} icon={<Reply className="h-4 w-4" />} tone="success" />
        <StatCard
          label="Bounce rate"
          value={`${bounceRate.toFixed(1)}%`}
          caption={bounceRate > 3 ? 'Above the 3% working target' : 'Healthy: under 3%'}
          icon={<TrendingUp className="h-4 w-4" />}
          tone={bounceRate > 3 ? 'danger' : 'success'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Campaign performance" subtitle="Sent and replies, last 8 weeks" className="lg:col-span-2">
          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 0, height: 256 }}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="overviewSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="overviewReplied" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip cursor={{ stroke: 'var(--border)' }} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--popover)', color: 'var(--foreground)', boxShadow: 'var(--shadow-raised)' }} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="var(--chart-1)" strokeWidth={2} fill="url(#overviewSent)" />
                <Area type="monotone" dataKey="replied" name="Replies" stroke="var(--chart-2)" strokeWidth={2} fill="url(#overviewReplied)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {o.emailsSent === 0 && (
            <p className="mt-2 text-[12px] text-muted-foreground">No sends yet. The chart fills in as your first campaign runs.</p>
          )}
        </SectionCard>

        <SectionCard title="Sending mailboxes" subtitle="Today's volume" action={<HoverPrefetchLink href="/app/mailboxes" className="text-[12px] font-medium text-accent-foreground hover:underline">Manage</HoverPrefetchLink>}>
          {mailboxes.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border p-4 text-center">
              <Mail className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-[13px] font-medium text-foreground">No mailbox connected</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Connect one to start sending.</p>
              <HoverPrefetchLink href="/app/mailboxes" className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-foreground hover:underline">
                Connect mailbox <ArrowRight className="h-3 w-3" />
              </HoverPrefetchLink>
            </div>
          ) : (
            <ul className="space-y-3">
              {mailboxes.slice(0, 4).map(m => {
                const pct = m.dailyLimit ? Math.min(100, Math.round((m.sentToday / m.dailyLimit) * 100)) : 0;
                return (
                  <li key={m.id}>
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', mailboxDot[m.status] ?? 'bg-muted-foreground')} />
                      <p className="min-w-0 flex-1 truncate text-[13px] text-foreground">{m.email}</p>
                      <span className="text-[12px] tabular-nums text-muted-foreground">{m.sentToday}/{m.dailyLimit}</span>
                    </div>
                    <div className="mt-1.5 ml-4 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-[var(--danger)]' : pct >= 90 ? 'bg-[var(--warning)]' : 'bg-primary')} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">{mailboxLabel[m.status] ?? m.status}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {o.sendingHealth > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[12px]">
              <span className="text-muted-foreground">Sending health</span>
              <span className={cn('font-semibold', o.sendingHealth >= 80 ? 'text-[var(--success)]' : o.sendingHealth >= 60 ? 'text-[var(--warning)]' : 'text-[var(--danger)]')}>{o.sendingHealth}%</span>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Recent campaigns" subtitle="Your latest outreach" className="lg:col-span-2" action={<HoverPrefetchLink href="/app/campaigns" className="text-[12px] font-medium text-accent-foreground hover:underline">All campaigns</HoverPrefetchLink>}>
          {campaigns.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border p-6 text-center">
              <Megaphone className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-[13px] font-medium text-foreground">No campaigns yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Create your first campaign to start outreach.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {campaigns.slice(0, 5).map(c => (
                <Link key={c.id} href={`/app/campaigns/${c.id}`} className="flex items-center gap-4 py-3 transition-colors hover:bg-muted/40 -mx-2 rounded-lg px-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{c.name}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {c.emailsSent.toLocaleString()} sent · {c.replies} replies · {c.replyRate}% reply rate
                    </p>
                  </div>
                  <CampaignStatusBadge status={c.status} />
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Recent activity" subtitle="Latest lead events">
          {activity.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border p-6 text-center">
              <Clock className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="mt-2 text-[13px] font-medium text-foreground">No activity yet</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Sends, replies, and lead changes appear here once a campaign runs.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', a.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-foreground">{a.text}</p>
                    {a.time && <p className="mt-0.5 text-[12px] text-muted-foreground">{a.time}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Workspace checks" subtitle="Good practice for this workspace">
          <ul className="space-y-2.5">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">These describe good practice. They do not promise inbox placement.</p>
        </SectionCard>

        <SectionCard title="Jump back in" subtitle="The places people use most">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Unified inbox', detail: `${o.replied.toLocaleString()} replies recorded`, href: '/app/inbox', icon: Inbox, tone: 'neutral' },
              { label: 'Lead lists', detail: `${setup.leadLists} list${setup.leadLists === 1 ? '' : 's'}`, href: '/app/lead-lists', icon: Users, tone: 'neutral' },
              { label: 'AI email writer', detail: 'Draft or improve copy', href: '/app/ai-writer', icon: Sparkles, tone: 'ai' },
              { label: 'Analytics', detail: 'Performance over time', href: '/app/analytics', icon: TrendingUp, tone: 'neutral' },
            ].map(item => (
              <HoverPrefetchLink key={item.href} href={item.href} className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-3 py-2.5 transition-colors hover:bg-muted">
                <span className={cn('h-8 w-8 shrink-0 items-center justify-center rounded-[8px]', item.tone === 'ai' ? 'icon-tile-ai' : 'icon-tile')}>
                  <item.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-foreground">{item.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{item.detail}</span>
                </span>
              </HoverPrefetchLink>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-[10px] bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Unsubscribes</span>
            <span className="font-medium text-foreground tabular-nums">{o.unsubscribed.toLocaleString()}</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
