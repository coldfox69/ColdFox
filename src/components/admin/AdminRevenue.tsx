'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/shared/Skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { formatDateTimeValue, formatMoney, humanize, statusTone } from '@/lib/admin/shared';
import { fieldCls, secondaryBtnCls } from '@/lib/ui-classes';

interface Billing {
  mrr?: number;
  activeSubscriptions?: number;
  trialing?: number;
  pastDue?: number;
  failedPayments?: number;
  openInvoices?: number;
}
interface MonthPoint { month: string; label: string; cents: number; invoices: number }
interface DayPoint { day: string; cents?: number }
interface Invoice {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  issued_at: string;
  paid_at: string | null;
  organization_name: string;
}
interface SubscriptionRow {
  plan_key: string;
  status: string;
  plan_name: string;
  price_monthly: number;
}
interface RevenueData {
  days: number;
  billing: Billing;
  growth: { revenue: DayPoint[] };
  monthly: MonthPoint[];
  invoices: Invoice[];
  subscriptions: SubscriptionRow[];
}

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--popover-foreground)',
};

function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="neu-card rounded-[14px] px-4 py-3.5">
      <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-[23px] font-medium leading-none tabular-nums text-foreground">{value}</p>
      {caption ? <p className="mt-1.5 text-[11px] text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

export function AdminRevenue() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<RevenueData | null>(null);
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
    apiFetch<RevenueData>(`/api/admin/console/revenue?days=${days}`, { signal: control.signal })
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch((fetchError) => { if (!cancelled && !control.signal.aborted) setError(errorMessage(fetchError)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; control.abort(); };
  }, [days, token]);

  const planRows = useMemo(() => {
    const map = new Map<string, { name: string; count: number; mrr: number }>();
    for (const subscription of data?.subscriptions ?? []) {
      const current = map.get(subscription.plan_key) ?? { name: subscription.plan_name, count: 0, mrr: 0 };
      current.count += 1;
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        current.mrr += Number(subscription.price_monthly ?? 0);
      }
      map.set(subscription.plan_key, current);
    }
    return [...map.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.mrr - a.mrr);
  }, [data?.subscriptions]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 px-6 py-20 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm font-medium text-foreground">Revenue data could not be loaded</p>
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
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-[14px]" />)}
        </div>
        <Skeleton className="h-72 rounded-[16px]" />
      </div>
    );
  }

  if (!data) return null;

  const paidInWindow = data.growth.revenue.reduce((sum, point) => sum + (point.cents ?? 0), 0);
  const paidInvoices = data.invoices.filter((invoice) => invoice.status === 'paid');
  const paidTotal = data.invoices.reduce((sum, invoice) => sum + (invoice.status === 'paid' ? Number(invoice.amount_cents ?? 0) : 0), 0);
  const dailySeries = data.growth.revenue.map((point) => {
    const date = new Date(point.day);
    return {
      day: Number.isNaN(date.getTime()) ? point.day : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      revenue: Number(((point.cents ?? 0) / 100).toFixed(2)),
    };
  });

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight text-foreground">Revenue analytics</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Recurring revenue from active subscriptions and paid invoice totals recorded by the billing provider. This console never marks a payment as paid.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select value={days} onChange={(event) => { setLoading(true); setError(''); setDays(Number(event.target.value)); }} aria-label="Time window" className={cn(fieldCls, 'h-9 px-2.5')}>
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
        <Stat label="Monthly recurring revenue" value={formatMoney(data.billing.mrr ?? 0)} caption={`${data.billing.activeSubscriptions ?? 0} active subscriptions`} />
        <Stat label={`Paid in ${days} days`} value={formatMoney(paidInWindow)} caption="Provider recorded invoice payments" />
        <Stat label="Open invoices" value={(data.billing.openInvoices ?? 0).toLocaleString()} caption={`${data.billing.pastDue ?? 0} subscriptions past due`} />
        <Stat label="Paid invoice total" value={formatMoney(paidTotal)} caption={`${paidInvoices.length} paid invoice records`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">Paid revenue by month</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">The last six calendar months, from paid invoices only.</p>
          <div className="mt-3 h-64">
            {data.monthly.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value / 100}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatMoney(value as number), 'Paid']} />
                  <Bar dataKey="cents" name="Paid" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="pt-20 text-center text-[12px] text-muted-foreground">No paid invoices recorded.</p>}
          </div>
        </section>

        <section className="neu-card rounded-[16px] p-4">
          <h2 className="text-[14px] font-medium text-foreground">Daily paid revenue</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Paid invoice value per day in the selected window.</p>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySeries} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} minTickGap={26} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Paid']} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.16} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="neu-card overflow-hidden rounded-[16px] xl:col-span-3">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[14px] font-medium text-foreground">Recent invoices</h2>
            <p className="text-[12px] text-muted-foreground">The fifty most recent invoice records.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left text-[13px]">
              <thead className="text-[12px] text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="px-4 py-2 font-medium">Workspace</th>
                  <th scope="col" className="px-4 py-2 font-medium">Amount</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Issued</th>
                  <th scope="col" className="px-4 py-2 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No invoices recorded.</td></tr>
                ) : data.invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">{invoice.organization_name || 'Unknown workspace'}</td>
                    <td className="px-4 py-2 tabular-nums">{formatMoney(invoice.amount_cents)}</td>
                    <td className="px-4 py-2"><StatusBadge variant={statusTone(invoice.status) as 'success' | 'warning' | 'danger' | 'muted'}>{humanize(invoice.status)}</StatusBadge></td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{formatDateTimeValue(invoice.issued_at)}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{invoice.paid_at ? formatDateTimeValue(invoice.paid_at) : 'Not paid'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="neu-card overflow-hidden rounded-[16px] xl:col-span-2">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-[14px] font-medium text-foreground">Revenue by plan</h2>
            <p className="text-[12px] text-muted-foreground">Subscription count and recurring value per plan.</p>
          </div>
          <div className="divide-y divide-border">
            {planRows.length === 0 ? (
              <p className="px-4 py-10 text-center text-[12px] text-muted-foreground">No subscriptions recorded.</p>
            ) : planRows.map((plan) => (
              <div key={plan.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{plan.name}</p>
                  <p className="text-[11px] text-muted-foreground">{plan.count} subscriptions</p>
                </div>
                <p className="tabular-nums text-[13px] text-foreground">{formatMoney(plan.mrr)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
