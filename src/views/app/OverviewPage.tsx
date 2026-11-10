'use client';

import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { HoverPrefetchLink } from '@/components/shared/HoverPrefetchLink';
import { CampaignStatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import type { OverviewVM } from '@/lib/view-models';

const mailboxDot: Record<string, string> = { connected: 'bg-[var(--cf-success)]', error: 'bg-destructive', syncing: 'bg-[var(--cf-warning)]', disconnected: 'bg-muted-foreground' };

const quickActions = [
  { label: 'Create a campaign', to: '/app/campaigns/new' },
  { label: 'Write with AI', to: '/app/ai-writer' },
  { label: 'Open unified inbox', to: '/app/inbox' },
  { label: 'Connect a mailbox', to: '/app/mailboxes' },
];

export default function OverviewPage({ data }: { data: OverviewVM }) {
  const { totals: o, chartData, campaigns, mailboxes, activity, recommendations } = data;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').slice(0, 4);
  const bounceRate = o.emailsSent ? (o.bounced / o.emailsSent) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Overview"
        description="What your workspace did most recently"
        actions={
          <>
            <Link href="/app/leads" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-card px-4 text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">Import leads</Link>
            <Link href="/app/campaigns/new" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">New campaign</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard title="Total leads" value={o.totalLeads.toLocaleString()} change="Across this workspace" />
        <StatCard title="Emails sent" value={o.emailsSent.toLocaleString()} change="Accepted by the provider" />
        <StatCard title="Replies" value={o.replied.toLocaleString()} change="Recorded in the inbox" />
        <StatCard title="Bounce rate" value={`${bounceRate.toFixed(1)}%`} change="Under 3% is the working target" changeType={bounceRate > 3 ? 'negative' : 'neutral'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="neu-card min-w-0 rounded-[16px] p-5 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Campaign performance</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Sent against replies, last 8 weeks</p>
            </div>
          </div>
          <div className="h-72 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 0, height: 288 }}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip cursor={{ stroke: 'var(--border)' }} contentStyle={{ fontSize: 12, borderRadius: 10, border: 'none', background: 'var(--popover)', color: 'var(--foreground)', boxShadow: 'var(--shadow-raised)' }} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="var(--chart-1)" strokeWidth={2} fill="var(--chart-1)" fillOpacity={0.1} />
                <Area type="monotone" dataKey="replied" name="Replies" stroke="var(--chart-2)" strokeWidth={2} fill="var(--chart-2)" fillOpacity={0.08} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="neu-card rounded-[16px] p-5">
          <h2 className="font-semibold text-foreground">Sending status</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Per mailbox, today</p>
          <div className="mt-4 space-y-3">
            {mailboxes.length === 0 && (
              <p className="text-[13px] text-muted-foreground">No mailbox connected yet</p>
            )}
            {mailboxes.map(m => (
              <div key={m.id} className="flex items-center gap-3">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', mailboxDot[m.status])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-foreground">{m.email}</p>
                  <p className="text-[12px] text-muted-foreground">{m.sentToday} of {m.dailyLimit} sent</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-[13px] font-medium text-muted-foreground">Jump to</p>
            <ul className="space-y-1">
              {quickActions.map(a => (
                <li key={a.to}>
                  <HoverPrefetchLink href={a.to} className="flex items-center justify-between rounded-[8px] px-2 py-1.5 text-[13px] text-foreground transition-colors duration-[var(--dur)] hover:bg-muted">
                    {a.label}
                    <span aria-hidden className="text-muted-foreground">→</span>
                  </HoverPrefetchLink>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="neu-card rounded-[16px] p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Recent campaigns</h2>
            <HoverPrefetchLink href="/app/campaigns" className="text-[13px] font-medium text-accent-foreground hover:underline">All campaigns</HoverPrefetchLink>
          </div>
          {activeCampaigns.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No active campaigns right now</p>
          ) : (
            <div className="divide-y divide-border">
              {activeCampaigns.map(c => (
                <div key={c.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{c.name}</p>
                    <p className="text-[12px] text-muted-foreground">{c.emailsSent.toLocaleString()} sent · {c.replies} replies</p>
                  </div>
                  <CampaignStatusBadge status={c.status} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="neu-card rounded-[16px] p-5">
          <h2 className="font-semibold text-foreground">Recent activity</h2>
          <ul className="mt-4 space-y-3">
            {activity.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', a.dot)} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground">{a.text}</p>
                  <p className="text-[12px] text-muted-foreground">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="neu-card rounded-[16px] p-5">
          <h2 className="font-semibold text-foreground">Workspace checks</h2>
          <ul className="mt-4 space-y-3">
            {recommendations.map((r, i) => (
              <li key={i} className="border-l-2 border-primary pl-3 text-[13px] leading-relaxed text-foreground">{r}</li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-muted-foreground">These describe good practice for this workspace. They do not promise inbox placement.</p>
        </section>
        <section className="neu-card rounded-[16px] p-5">
          <h2 className="font-semibold text-foreground">Counts</h2>
          <dl className="mt-4 space-y-2">
            {[
              ['Active campaigns', o.activeCampaigns],
              ['Delivered', o.delivered.toLocaleString()],
              ['Unsubscribes', o.unsubscribed.toLocaleString()],
              ['Sending health', o.sendingHealth ? `${o.sendingHealth}%` : 'Not rated'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-baseline justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
                <dt className="text-[13px] text-muted-foreground">{label}</dt>
                <dd className="text-[13px] font-medium text-foreground tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
