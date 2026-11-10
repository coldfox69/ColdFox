'use client';

import { useMemo, useState } from 'react';
import { Download, Info } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { useToast } from '@/components/shared/ToastProvider';
import { type AnalyticsVM } from '@/lib/view-models';
import { cn } from '@/lib/utils';

const ranges = ['Last 7 days', 'Last 30 days', 'Last 90 days'] as const;
type Range = (typeof ranges)[number];

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
  const visibleChart = range === 'Last 7 days' ? chartData.slice(-2) : range === 'Last 30 days' ? chartData.slice(-5) : chartData;

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
    <div className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Analytics"
        description="Delivery and reply results across your campaigns and mailboxes"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select value={range} onChange={e => setRange(e.target.value as Range)} aria-label="Date range" className="h-9 rounded-[10px] border border-transparent bg-input px-3 text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] focus:border-ring focus:ring-[3px] focus:ring-ring/50">
              {ranges.map(r => <option key={r}>{r}</option>)}
            </select>
            <button onClick={exportReport} className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
              <Download className="w-4 h-4" /> Export report
            </button>
          </div>
        }
      />

      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Info className="w-4 h-4 shrink-0" /> Sent, delivered, reply and bounce counts come from your mail provider. Opens are not tracked as reads, so no open rate is shown.
      </p>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Emails sent" value={overview.emailsSent.toLocaleString()} change="Provider-confirmed" />
        <StatCard title="Delivered" value={`${pct(overview.delivered, overview.emailsSent)}%`} change={`${overview.delivered.toLocaleString()} accepted by providers`} />
        <StatCard title="Reply rate" value={`${rates.reply}%`} change={`${overview.replies.toLocaleString()} replies`} changeType="positive" />
        <StatCard title="Unsubscribes" value={`${rates.unsub}%`} change={`${overview.unsubscribes.toLocaleString()} suppressed`} changeType="negative" />
      </div>

      <section className="neu-card rounded-[16px] p-5">
        <h2 className="font-semibold text-foreground">Sent against replies</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{range.toLowerCase()}</p>
        <div className="mt-4 h-80" role="img" aria-label="Area chart of emails sent and replies over time">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visibleChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={44} />
              <Tooltip cursor={{ stroke: 'var(--border)' }} contentStyle={{ fontSize: 12, borderRadius: 10, border: 'none', background: 'var(--popover)', color: 'var(--foreground)', boxShadow: 'var(--shadow-raised)' }} />
              <Area type="monotone" dataKey="sent" name="Sent" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="replied" name="Replies" stroke="var(--chart-2)" fill="none" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="neu-card rounded-[16px] p-5">
          <h2 className="font-semibold text-foreground">Mailbox capacity</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Today&apos;s sends against each mailbox limit</p>
          <div className="mt-4 space-y-4">
            {mailboxes.length === 0 && <p className="text-[13px] text-muted-foreground">Connect a mailbox to see sending capacity here.</p>}
            {mailboxes.map(m => (
              <div key={m.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] text-foreground">{m.email}</span>
                  <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">{m.sentToday.toLocaleString()} / {m.dailyLimit.toLocaleString()}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-input shadow-[var(--shadow-inset-sm)]">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--dur-slow)] ease-[var(--ease)]" style={{ width: `${pct(m.sentToday, m.dailyLimit)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="neu-card rounded-[16px] p-5">
          <div>
            <h2 className="font-semibold text-foreground">Campaign comparison</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Select up to 4 campaigns to compare</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Campaigns to compare">
            {campaigns.map(c => (
              <button key={c.id} onClick={() => toggleCompare(c.id)} aria-pressed={compareIds.includes(c.id)} className={cn('rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-colors duration-[var(--dur)]', compareIds.includes(c.id) ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>
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
                  <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Campaign</th>
                    <th className="py-2 pr-4 text-right font-medium">Sent</th>
                    <th className="py-2 pr-4 text-right font-medium">Replies</th>
                    <th className="py-2 pr-4 text-right font-medium">Reply rate</th>
                    <th className="py-2 text-right font-medium">Bounce rate</th>
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
        </section>
      </div>
    </div>
  );
}
