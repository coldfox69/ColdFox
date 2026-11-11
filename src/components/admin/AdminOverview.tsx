'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowUpRight, Building2, Cpu, Mail, Megaphone, RefreshCw,
  Ticket, Users, Wallet,
} from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { formatDateTimeValue, formatMoney, humanize, statusTone } from '@/lib/admin/shared';
import { secondaryBtnCls } from '@/lib/ui-classes';

interface Bucket {
  day: string;
  count?: number;
  cents?: number;
}

interface Growth {
  signups: Bucket[];
  organizations: Bucket[];
  emails: Bucket[];
  campaigns: Bucket[];
  revenue: Bucket[];
}

interface Integration {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
}

interface OverviewData {
  totals: Record<string, number>;
  planCounts: Record<string, number>;
  campaignStatuses: Record<string, number>;
  jobStatuses: Record<string, number>;
  ticketStatuses: Record<string, number>;
  mailboxStatuses: Record<string, number>;
  eventCounts: Record<string, number>;
  growth: Growth;
  integrations: Integration[];
  recentOrganizations: Array<Record<string, unknown>>;
  recentAudit: Array<Record<string, unknown>>;
  recentErrors: Array<Record<string, unknown>>;
}

const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

function chartDate(day: string) {
  const date = new Date(day);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Stat({
  label, value, caption, icon: Icon, href,
}: {
  label: string;
  value: string;
  caption?: string;
  icon: typeof Users;
  href?: string;
}) {
  const content = (
    <div className="neu-card h-full rounded-[14px] px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-accent-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="mt-1.5 text-[24px] font-medium leading-none tabular-nums text-foreground">{value}</p>
      {caption ? <p className="mt-1.5 text-[11px] text-muted-foreground">{caption}</p> : null}
    </div>
  );
  return href ? <Link href={href} className="block rounded-[14px] transition-transform hover:-translate-y-px">{content}</Link> : content;
}

function ChartCard({
  title, description, children, action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="neu-card rounded-[16px] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--popover-foreground)',
};

export function AdminOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setError('');
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const control = new AbortController();
    apiFetch<OverviewData>('/api/admin/console/overview', { signal: control.signal })
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((fetchError) => { if (!cancelled && !control.signal.aborted) setError(errorMessage(fetchError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; control.abort(); };
  }, [token]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-6 py-20 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-foreground">The overview could not be loaded</p>
        <p className="max-w-md text-[13px] text-muted-foreground">{error}</p>
        <button type="button" onClick={refresh} className={cn(secondaryBtnCls, 'h-9 px-4')}>Try again</button>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-[14px]" />)}
        </div>
        <Skeleton className="h-72 rounded-[16px]" />
        <Skeleton className="h-64 rounded-[16px]" />
      </div>
    );
  }

  if (!data) return null;

  const totals = data.totals;
  const campaignRows = Object.entries(data.campaignStatuses).map(([key, value]) => ({ name: humanize(key), value }));
  const growth = data.growth;
  const emailSeries = growth.emails.map((point) => ({ day: chartDate(point.day), events: point.count ?? 0 }));
  const signupSeries = growth.signups.map((point, index) => ({
    day: chartDate(point.day),
    signups: point.count ?? 0,
    workspaces: growth.organizations[index]?.count ?? 0,
  }));

  const attention = [
    { label: 'Suspended users', value: totals.suspendedUsers ?? 0, href: '/admin/users', tone: 'danger' },
    { label: 'Suspended workspaces', value: totals.suspendedOrganizations ?? 0, href: '/admin/organizations', tone: 'warning' },
    { label: 'Past due subscriptions', value: totals.pastDue ?? 0, href: '/admin/subscriptions', tone: 'warning' },
    { label: 'Unresolved errors', value: (data.recentErrors ?? []).length, href: '/admin/errors', tone: 'danger' },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[12px] font-medium text-muted-foreground">Owner console</p>
          <h1 className="mt-0.5 text-[26px] font-semibold leading-tight text-foreground">Platform overview</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Live totals from the database. Every figure is an aggregate of recorded users, workspaces, campaigns, mailboxes, events and invoices.
          </p>
        </div>
        <button type="button" onClick={refresh} className={cn(secondaryBtnCls, 'h-9 shrink-0 px-3')}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Users" value={(totals.users ?? 0).toLocaleString()} caption={`${totals.activeUsers ?? 0} signed in within 30 days`} icon={Users} href="/admin/users" />
        <Stat label="Workspaces" value={(totals.organizations ?? 0).toLocaleString()} caption={`${totals.paidSubscribers ?? 0} on paid plans`} icon={Building2} href="/admin/organizations" />
        <Stat label="Monthly recurring revenue" value={formatMoney(totals.mrr ?? 0)} caption={`${totals.activeSubscriptions ?? 0} active, ${totals.trialing ?? 0} trialing`} icon={Wallet} href="/admin/revenue" />
        <Stat label="Active campaigns" value={(totals.activeCampaigns ?? 0).toLocaleString()} caption={`${totals.campaigns ?? 0} in total`} icon={Megaphone} href="/admin/campaigns" />
        <Stat label="Leads" value={(totals.leads ?? 0).toLocaleString()} caption="Across all workspaces" icon={Users} href="/admin/leads" />
        <Stat label="Connected mailboxes" value={(totals.connectedMailboxes ?? 0).toLocaleString()} caption={`${totals.mailboxes ?? 0} recorded`} icon={Mail} href="/admin/mailboxes" />
        <Stat label="Delivered emails" value={(totals.delivered ?? 0).toLocaleString()} caption={`${totals.replies ?? 0} replies, ${totals.bounces ?? 0} bounces`} icon={Mail} href="/admin/email-activity" />
        <Stat label="AI usage, 30 days" value={(totals.aiRequests ?? 0).toLocaleString()} caption={`${formatMoney((totals.aiCostMicros ?? 0) / 10_000)} recorded cost`} icon={Cpu} href="/admin/ai-usage" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="New users and workspaces" description="Daily sign-ups and new workspaces over the last 30 days.">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signupSeries} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="signups" name="New users" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.14} strokeWidth={2} />
                <Area type="monotone" dataKey="workspaces" name="New workspaces" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Email activity" description="All recorded email events per day over the last 30 days.">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={emailSeries} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="events" name="Email events" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.16} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Campaigns by status" description="Where the customer campaigns currently sit.">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignRows} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Campaigns" radius={[4, 4, 0, 0]}>
                  {campaignRows.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <section className="neu-card rounded-[16px] p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-medium text-foreground">Needs attention</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">States that usually need an operator decision.</p>
            </div>
            <Link href="/admin/system-health" className="flex items-center gap-1 text-[12px] font-medium text-accent-foreground hover:underline">
              System health <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {attention.map((item) => (
              <Link key={item.label} href={item.href} className="rounded-[10px] neu-inset-sm px-3 py-2.5 transition-transform hover:-translate-y-px">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className={cn('mt-1 text-[20px] font-medium tabular-nums', item.tone === 'danger' ? 'text-destructive' : 'text-foreground')}>
                  {item.value.toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.integrations.map((integration) => (
              <div key={integration.key} className="flex items-center justify-between gap-3 rounded-[8px] px-1 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-foreground">{integration.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{integration.detail}</p>
                </div>
                <StatusBadge variant={integration.configured ? 'success' : 'muted'}>
                  {integration.configured ? 'Configured' : 'Not configured'}
                </StatusBadge>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="neu-card overflow-hidden rounded-[16px] xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-[14px] font-medium text-foreground">Newest workspaces</h2>
              <p className="text-[12px] text-muted-foreground">The last eight organizations created.</p>
            </div>
            <Link href="/admin/organizations" className="text-[12px] font-medium text-accent-foreground hover:underline">All workspaces</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[13px]">
              <thead className="text-[12px] text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="px-4 py-2 font-medium">Workspace</th>
                  <th scope="col" className="px-4 py-2 font-medium">Plan</th>
                  <th scope="col" className="px-4 py-2 font-medium">Created</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrganizations.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No workspaces yet.</td></tr>
                ) : data.recentOrganizations.map((org) => (
                  <tr key={String(org.id)} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">{String(org.name)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{String(org.plan_name ?? org.plan_key ?? 'Free')}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{formatDateTimeValue(org.created_at)}</td>
                    <td className="px-4 py-2">
                      <StatusBadge variant={org.is_suspended ? 'danger' : 'success'}>
                        {org.is_suspended ? 'Suspended' : 'Active'}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="neu-card rounded-[16px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-foreground">Recent admin changes</h2>
            <Link href="/admin/audit" className="text-[12px] font-medium text-accent-foreground hover:underline">Audit</Link>
          </div>
          <ul className="space-y-2.5">
            {data.recentAudit.length === 0 ? (
              <li className="text-[12px] text-muted-foreground">No administrative changes recorded yet.</li>
            ) : data.recentAudit.map((entry) => (
              <li key={String(entry.id)} className="flex items-start gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-medium text-foreground">{String(entry.action)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {String(entry.actor_email ?? 'System')} · {formatDateTimeValue(entry.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {data.recentErrors.length ? (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-foreground">Latest errors</h2>
                <Link href="/admin/errors" className="text-[12px] font-medium text-accent-foreground hover:underline">Errors</Link>
              </div>
              <ul className="space-y-2">
                {data.recentErrors.slice(0, 3).map((entry) => (
                  <li key={String(entry.id)} className="flex items-start gap-2">
                    <StatusBadge variant={statusTone(entry.level) as 'danger' | 'warning' | 'muted'}>{String(entry.level)}</StatusBadge>
                    <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{String(entry.message)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { href: '/admin/tickets', label: 'Support tickets', icon: Ticket, value: totals.openTickets ?? data.ticketStatuses.open ?? 0 },
          { href: '/admin/analytics', label: 'Analytics', icon: ArrowUpRight, value: 'Open' },
          { href: '/admin/revenue', label: 'Revenue', icon: Wallet, value: 'Open' },
          { href: '/admin/plans', label: 'Plans', icon: Building2, value: 'Open' },
          { href: '/admin/jobs', label: 'Background jobs', icon: Cpu, value: (data.jobStatuses.queued ?? 0) + (data.jobStatuses.processing ?? 0) },
          { href: '/admin/audit', label: 'Audit log', icon: Ticket, value: 'Open' },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="neu-card flex items-center gap-2.5 rounded-[12px] px-3 py-2.5 transition-transform hover:-translate-y-px">
            <item.icon className="h-4 w-4 text-accent-foreground" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-foreground">{item.label}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
