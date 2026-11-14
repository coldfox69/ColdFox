'use client';

import { useMemo, useState } from 'react';
import { Download, Info, BarChart2, Send, CheckCircle2, Reply, UserMinus } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/shared/ToastProvider';
import { type AnalyticsVM } from '@/lib/view-models';
import { cn } from '@/lib/utils';

const ranges = ['Last 7 days', 'Last 30 days', 'Last 90 days'] as const;
type Range = (typeof ranges)[number];

/** chartData is bucketed per week, newest last. */
const bucketsFor: Record<Range, number> = {
  'Last 7 days': 1,
  'Last 30 days': 4,
  'Last 90 days': 8,
};

const pct = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage({ data }: { data: AnalyticsVM }) {
  const toast = useToast();
  const [range, setRange] = useState<Range>('Last 30 days');
  const [compareIds, setCompareIds] = useState<string[]>(() => data.campaigns.slice(0, 2).map(c => c.id));

  const { totals: overview, chartData, campaigns, mailboxes } = data;
  const rates = useMemo(() => ({
    reply: pct(overview.replies, overview.delivered || overview.emailsSent),
    bounce: pct(overview.bounces, overview.emailsSent),
    unsub: pct(overview.unsubscribes, overview.emailsSent),
  }), [overview]);

  const compared = campaigns.filter(c => compareIds.includes(c.id));
  const visibleChart = chartData.slice(-bucketsFor[range]);
  const hasSends = overview.emailsSent > 0;

  const toggleCompare = (id: string) =>
    setCompareIds(ids => {
      if (ids.includes(id)) return ids.filter(x => x !== id);
      if (ids.length >= 4) {
        toast.show('Compare up to 4 campaigns at a time.', 'info');
        return ids;
      }
      return [...ids, id];
    });

  const exportReport = () => {
    downloadCsv('coldfox-analytics.csv', [
      ['Metric', 'Value', 'Source'],
      ['Emails sent', overview.emailsSent, 'Provider-confirmed'],
      ['Delivered', overview.delivered, 'Provider-confirmed'],
      ['Replies', overview.replies, 'Provider-confirmed'],
      ['Bounced', overview.bounces, 'Provider-confirmed'],
      ['Unsubscribed', overview.unsubscribes, 'Provider-confirmed'],
      [],
      ['Campaign', 'Status', 'Emails sent', 'Replies', 'Reply rate %', 'Bounce rate %'],
      ...campaigns.map(c => [c.name, c.status, c.emailsSent, c.replies, c.replyRate, c.bounceRate]),
    ]);
    toast.show('Report downloaded.', 'success');
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Analytics"
        description="Delivery and reply results across your campaigns and mailboxes. Numbers come from your mail provider, not estimates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="analytics-range" className="sr-only">Date range</label>
            <select
              id="analytics-range"
              value={range}
              onChange={e => setRange(e.target.value as Range)}
              className="h-9 rounded-[10px] border border-border bg-input px-3 text-[13px] outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/15"
            >
              {ranges.map(r => <option key={r}>{r}</option>)}
            </select>
            <button onClick={exportReport} className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
              <Download className="h-4 w-4" /> Export report
            </button>
          </div>
        }
      />

      <p className="flex items-start gap-2 rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" /> Opens are not tracked as reads, so no open rate is shown. Only provider-confirmed events are counted.
      </p>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <StatCard title="Emails sent" value={overview.emailsSent.toLocaleString()} change="Accepted by your provider" icon={<Send className="h-4 w-4" />} tone="brand" />
        <StatCard title="Delivered" value={`${pct(overview.delivered, overview.emailsSent)}%`} change={`${overview.delivered.toLocaleString()} accepted`} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <StatCard title="Reply rate" value={`${rates.reply}%`} change={`${overview.replies.toLocaleString()} replies`} changeType={overview.replies > 0 ? 'positive' : 'neutral'} icon={<Reply className="h-4 w-4" />} tone="success" />
        <StatCard title="Unsubscribes" value={`${rates.unsub}%`} change={`${overview.unsubscribes.toLocaleString()} suppressed`} icon={<UserMinus className="h-4 w-4" />} tone="warning" />
      </div>

      <section className="neu-card min-w-0 rounded-[16px] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-foreground">Sent against replies</h2>
          <p className="text-[12px] text-muted-foreground">{range.toLowerCase()} · weekly totals</p>
        </div>
        {visibleChart.length === 0 ? (
          <div className="mt-4">
            <EmptyState size="sm" icon={<BarChart2 className="h-5 w-5" />} title="No data in this range" description="Activity appears after your first campaign sends email." />
          </div>
        ) : (
          <div className="mt-4 h-72 min-w-0" role="img" aria-label="Area chart of emails sent and replies over time">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 0, height: 288 }}>
              <AreaChart data={visibleChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsSent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip cursor={{ stroke: 'var(--border)' }} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--popover)', color: 'var(--foreground)', boxShadow: 'var(--shadow-raised)' }} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="var(--chart-1)" fill="url(#analyticsSent)" strokeWidth={2} />
                <Area type="monotone" dataKey="replied" name="Replies" stroke="var(--chart-2)" fill="none" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground" aria-hidden="true">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" /> Sent</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--chart-2)]" /> Replies</span>
        </div>
        {!hasSends && (
          <p className="mt-2 text-[12px] text-muted-foreground">No sends yet. The chart fills in as your first campaign runs.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="neu-card rounded-[16px] p-5">
          <h2 className="text-[15px] font-semibold text-foreground">Mailbox capacity</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Today&apos;s sends against each mailbox limit</p>
          <div className="mt-4 space-y-4">
            {mailboxes.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
                Connect a mailbox to see sending capacity here.
              </p>
            ) : mailboxes.map(m => {
              const used = pct(m.sentToday, m.dailyLimit);
              return (
                <div key={m.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] text-foreground">{m.email}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{m.sentToday.toLocaleString()} / {m.dailyLimit.toLocaleString()}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease)]', used >= 100 ? 'bg-[var(--danger)]' : used >= 90 ? 'bg-[var(--warning)]' : 'bg-primary')} style={{ width: `${Math.min(100, used)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="neu-card rounded-[16px] p-5">
          <h2 className="text-[15px] font-semibold text-foreground">Campaign comparison</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Select up to 4 campaigns to compare</p>
          {campaigns.length === 0 ? (
            <p className="mt-4 rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
              No campaigns yet. Create one to compare results here.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Campaigns to compare">
                {campaigns.map(c => (
                  <button
                    key={c.id}
                    onClick={() => toggleCompare(c.id)}
                    aria-pressed={compareIds.includes(c.id)}
                    className={cn('rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors', compareIds.includes(c.id) ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'border-border text-muted-foreground hover:bg-muted')}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {compared.length === 0 ? (
                <p className="mt-4 text-[13px] text-muted-foreground">Select a campaign to see its results.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                        <th className="py-2 pr-4 font-semibold">Campaign</th>
                        <th className="py-2 pr-4 text-right font-semibold">Sent</th>
                        <th className="py-2 pr-4 text-right font-semibold">Replies</th>
                        <th className="py-2 pr-4 text-right font-semibold">Reply rate</th>
                        <th className="py-2 text-right font-semibold">Bounce rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {compared.map(c => (
                        <tr key={c.id}>
                          <td className="py-3 pr-4 text-foreground">{c.name}</td>
                          <td className="py-3 pr-4 text-right tabular-nums">{c.emailsSent.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-right tabular-nums">{c.replies.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-right tabular-nums">{c.replyRate}%</td>
                          <td className="py-3 text-right tabular-nums">{c.bounceRate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
