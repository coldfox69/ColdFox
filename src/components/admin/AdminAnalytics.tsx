'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { formatMoney, humanize } from '@/lib/admin/shared';
import { fieldCls, secondaryBtnCls } from '@/lib/ui-classes';

interface Bucket { day: string; count?: number; cents?: number }
interface Growth {
  signups: Bucket[];
  organizations: Bucket[];
  emails: Bucket[];
  campaigns: Bucket[];
  revenue: Bucket[];
}
interface Billing {
  mrr?: number;
  activeSubscriptions?: number;
  trialing?: number;
  pastDue?: number;
  openInvoices?: number;
}
interface AiSummary {
  requests?: number;
  tokens?: number;
  costMicros?: number;
  byKind?: Record<string, { requests?: number; tokens?: number; costMicros?: number }>;
}
interface TopOrganization {
  id: string;
  name: string;
  plan_key: string;
  is_suspended: boolean;
  leads: number;
  campaigns: number;
  mailboxes: number;
}
interface AnalyticsData {
  days: number;
  growth: Growth;
  billing: Billing;
  campaignStatuses: Record<string, number>;
  eventCounts: Record<string, number>;
  jobStatuses: Record<string, number>;
  mailboxStatuses: Record<string, number>;
  ai: AiSummary;
  topOrganizations: TopOrganization[];
}

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--popover-foreground)',
};

function chartDate(day: string) {
  const date = new Date(day);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="neu-card rounded-[14px] px-4 py-3.5">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[23px] font-medium leading-none tabular-nums text-foreground">{value}</p>
      {caption ? <p className="mt-1.5 text-[11px] text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function AdminAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
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
    apiFetch<AnalyticsData>(`/api/admin/console/analytics?days=${days}`, { signal: control.signal })
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((fetchError) => { if (!cancelled && !control.signal.aborted) setError(errorMessage(fetchError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; control.abort(); };
  }, [days, token]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-6 py-20 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-foreground">Analytics could not be loaded</p>
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
      </div>
    );
  }

  if (!data) return null;

  const growth = data.growth;
  const signupSeries = growth.signups.map((point, index) => ({
    day: chartDate(point.day),
    users: point.count ?? 0,
    workspaces: growth.organizations[index]?.count ?? 0,
  }));
  const emailSeries = growth.emails.map((point) => ({ day: chartDate(point.day), events: point.count ?? 0 }));
  const campaignRows = Object.entries(data.campaignStatuses).map(([key, value]) => ({ name: humanize(key), value }));
  const mailboxRows = Object.entries(data.mailboxStatuses).map(([key, value]) => ({ name: humanize(key), value }));
  const aiKinds = Object.entries(data.ai.byKind ?? {}).map(([key, value]) => ({
    name: humanize(key),
    requests: value.requests ?? 0,
    tokens: value.tokens ?? 0,
  }));
  const totalSignups = growth.signups.reduce((sum, point) => sum + (point.count ?? 0), 0);
  const totalWorkspaces = growth.organizations.reduce((sum, point) => sum + (point.count ?? 0), 0);
  const totalEmails = growth.emails.reduce((sum, point) => sum + (point.count ?? 0), 0);
  const totalRevenue = growth.revenue.reduce((sum, point) => sum + (point.cents ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-foreground">Platform analytics</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Growth, engagement and revenue aggregates over the selected window. All series are generated from database records.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={days}
            onChange={(event) => { setLoading(true); setError(''); setDays(Number(event.target.value)); }}
            aria-label="Time window"
            className={cn(fieldCls, 'h-9 px-2.5')}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
          <button type="button" onClick={refresh} className={cn(secondaryBtnCls, 'h-9 px-3')}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`New users, ${days} days`} value={totalSignups.toLocaleString()} caption="Accounts created in the window" />
        <Stat label={`New workspaces, ${days} days`} value={totalWorkspaces.toLocaleString()} caption="Organizations created in the window" />
        <Stat label={`Email events, ${days} days`} value={totalEmails.toLocaleString()} caption={`${(data.eventCounts.delivered ?? 0).toLocaleString()} delivered overall`} />
        <Stat label={`Paid revenue, ${days} days`} value={formatMoney(totalRevenue)} caption="Invoices marked paid by the provider" />
        <Stat label="Monthly recurring revenue" value={formatMoney(data.billing.mrr ?? 0)} caption="Active and trialing subscriptions" />
        <Stat label="Active subscriptions" value={(data.billing.activeSubscriptions ?? 0).toLocaleString()} caption={`${data.billing.trialing ?? 0} trialing`} />
        <Stat label={`AI requests, ${days} days`} value={(data.ai.requests ?? 0).toLocaleString()} caption={`${(data.ai.tokens ?? 0).toLocaleString()} tokens`} />
        <Stat label={`AI cost, ${days} days`} value={formatMoney((data.ai.costMicros ?? 0) / 10_000)} caption="Recorded cost from the usage ledger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">Sign-ups and workspaces</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Daily count across the selected window.</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={signupSeries} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} minTickGap={26} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="users" name="New users" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="workspaces" name="New workspaces" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.1} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">Email activity</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">All email events recorded per day.</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={emailSeries} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} minTickGap={26} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="events" name="Email events" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.16} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">Campaign status</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">All non-archived campaigns.</p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignRows} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Campaigns" radius={[4, 4, 0, 0]}>
                  {campaignRows.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">Mailbox status</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Sending identities by connection state.</p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mailboxRows} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Mailboxes" radius={[4, 4, 0, 0]}>
                  {mailboxRows.map((entry, index) => <Cell key={entry.name} fill={COLORS[(index + 1) % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">AI usage by kind</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Requests recorded in the window.</p>
          <div className="mt-3 h-52">
            {aiKinds.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aiKinds} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="requests" name="Requests" radius={[4, 4, 0, 0]}>
                    {aiKinds.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="pt-16 text-center text-[12px] text-muted-foreground">No AI usage recorded in this window.</p>}
          </div>
        </section>
      </div>

      <section className="neu-card overflow-hidden rounded-[16px]">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-[14px] font-medium text-foreground">Workspaces by activity</h2>
          <p className="text-[12px] text-muted-foreground">The busiest workspaces by lead and campaign volume.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[13px]">
            <thead className="text-[12px] text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-2 font-medium">Workspace</th>
                <th scope="col" className="px-4 py-2 font-medium">Plan</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Leads</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Campaigns</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Mailboxes</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.topOrganizations.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No workspaces yet.</td></tr>
              ) : data.topOrganizations.map((org) => (
                <tr key={org.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2 font-medium text-foreground">{org.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{humanize(org.plan_key)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{org.leads.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{org.campaigns.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{org.mailboxes.toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <StatusBadge variant={org.is_suspended ? 'danger' : 'success'}>{org.is_suspended ? 'Suspended' : 'Active'}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
