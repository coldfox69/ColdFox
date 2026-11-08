'use client';

import { useMemo, useState } from 'react';
import { Download, Send, CheckCheck, MessageSquare, Ban, Info } from 'lucide-react';
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Analytics"
        description="Delivery and reply results across your campaigns and mailboxes."
        actions={
          <div className="flex flex-wrap gap-2">
            <select value={range} onChange={e => setRange(e.target.value as Range)} aria-label="Date range" className="px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {ranges.map(r => <option key={r}>{r}</option>)}
            </select>
            <button onClick={exportReport} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-blue text-white text-sm font-semibold hover:opacity-90">
              <Download className="w-4 h-4" /> Export report
            </button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0" /> Sent, delivered, reply, and bounce counts come from your mail provider. Opens are not tracked as reads, so no open rate is shown.
      </p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Emails sent" value={overview.emailsSent.toLocaleString()} icon={<Send className="w-5 h-5" />} change="Provider-confirmed" changeType="neutral" />
        <StatCard title="Delivered" value={`${pct(overview.delivered, overview.emailsSent)}%`} icon={<CheckCheck className="w-5 h-5" />} change={`${overview.delivered.toLocaleString()} accepted by providers`} changeType="neutral" iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard title="Reply rate" value={`${rates.reply}%`} icon={<MessageSquare className="w-5 h-5" />} change={`${overview.replies.toLocaleString()} replies`} changeType="positive" />
        <StatCard title="Unsubscribes" value={`${rates.unsub}%`} icon={<Ban className="w-5 h-5" />} change={`${overview.unsubscribes.toLocaleString()} suppressed`} changeType="negative" iconColor="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
      </div>

      <section className="neu-card rounded-2xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Sent vs replies</h2>
        <div className="h-64" role="img" aria-label="Area chart of emails sent and replies over time">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visibleChart} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="sentFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--card-foreground)' }} />
              <Area type="monotone" dataKey="sent" name="Sent" stroke="var(--chart-1)" fill="url(#sentFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="replied" name="Replies" stroke="var(--chart-2)" fill="none" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="neu-card rounded-2xl p-5">
        <h2 className="font-semibold text-foreground mb-1">Mailbox capacity</h2>
        <p className="text-xs text-muted-foreground mb-4">Today&apos;s sends against each mailbox limit and reputation.</p>
        <div className="space-y-4">
          {mailboxes.length === 0 && <p className="text-sm text-muted-foreground">Connect a mailbox to see sending capacity here.</p>}
          {mailboxes.map(m => (
            <div key={m.id}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-foreground truncate">{m.email}</span>
                <span className="text-muted-foreground text-xs">{m.sentToday.toLocaleString()} / {m.dailyLimit.toLocaleString()} today · {m.reputation}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full gradient-blue" style={{ width: `${pct(m.sentToday, m.dailyLimit)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="neu-card rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-foreground">Campaign comparison</h2>
          <p className="text-xs text-muted-foreground">Select up to 4 campaigns to compare.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Campaigns to compare">
          {campaigns.map(c => (
            <button key={c.id} onClick={() => toggleCompare(c.id)} aria-pressed={compareIds.includes(c.id)} className={cn('px-3 py-1.5 rounded-full border text-xs font-medium transition-colors', compareIds.includes(c.id) ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>
              {c.name}
            </button>
          ))}
        </div>
        {compared.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select a campaign to see its results.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Campaign</th>
                  <th className="py-2 pr-4 font-medium text-right">Sent</th>
                  <th className="py-2 pr-4 font-medium text-right">Replies</th>
                  <th className="py-2 pr-4 font-medium text-right">Reply rate</th>
                  <th className="py-2 font-medium text-right">Bounce rate</th>
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
  );
}
