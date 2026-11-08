import Link from 'next/link';
import { Megaphone, Users, Send, CheckCheck, MessageSquare, AlertTriangle, UserMinus, ShieldCheck, Plus, Upload, Inbox, Sparkles, ArrowRight, Mail } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { CampaignStatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import type { OverviewVM } from '@/lib/view-models';

const mailboxDot: Record<string, string> = { connected: 'bg-emerald-500', error: 'bg-red-500', syncing: 'bg-amber-500', disconnected: 'bg-slate-400' };

export default function OverviewPage({ data }: { data: OverviewVM }) {
  const { totals: o, chartData, campaigns, mailboxes, activity, recommendations } = data;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').slice(0, 4);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Overview"
        description="Your outreach at a glance."
        actions={
          <>
            <Link href="/app/leads" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted"><Upload className="w-4 h-4" /> Import leads</Link>
            <Link href="/app/campaigns/new" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl gradient-blue text-white text-sm font-semibold hover:opacity-90"><Plus className="w-4 h-4" /> New campaign</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total leads" value={o.totalLeads.toLocaleString()} change="In your workspace" changeType="neutral" icon={<Users className="w-5 h-5" />} />
        <StatCard title="Active campaigns" value={o.activeCampaigns} change="Currently sending" icon={<Megaphone className="w-5 h-5" />} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
        <StatCard title="Emails sent" value={o.emailsSent.toLocaleString()} change="Provider-accepted" changeType="neutral" icon={<Send className="w-5 h-5" />} iconColor="bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400" />
        <StatCard title="Delivered" value={o.delivered.toLocaleString()} change="Provider-confirmed" changeType="neutral" icon={<CheckCheck className="w-5 h-5" />} iconColor="bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400" />
        <StatCard title="Replies" value={o.replied.toLocaleString()} change="Recorded replies" changeType="neutral" icon={<MessageSquare className="w-5 h-5" />} iconColor="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatCard title="Bounce rate" value={`${((o.bounced / Math.max(o.emailsSent, 1)) * 100).toFixed(1)}%`} change="Under 3% target" icon={<AlertTriangle className="w-5 h-5" />} iconColor="bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" />
        <StatCard title="Unsubscribes" value={o.unsubscribed} change="Suppression enforced" changeType="neutral" icon={<UserMinus className="w-5 h-5" />} iconColor="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" />
        <StatCard title="Sending health" value={o.sendingHealth ? `${o.sendingHealth}%` : ' - '} change="Mailbox reputation" changeType="neutral" icon={<ShieldCheck className="w-5 h-5" />} iconColor="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="neu-card rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-foreground">Campaign performance</h2>
              <p className="text-xs text-muted-foreground">Sent vs. replies, last 8 weeks</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient>
                  <linearGradient id="fillReply" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke="#2563eb" strokeWidth={2} fill="url(#fillSent)" />
                <Area type="monotone" dataKey="replied" name="Replies" stroke="#10b981" strokeWidth={2} fill="url(#fillReply)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="neu-card rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Quick actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Create a campaign', to: '/app/campaigns/new', icon: Megaphone },
              { label: 'Write with AI', to: '/app/ai-writer', icon: Sparkles },
              { label: 'Open unified inbox', to: '/app/inbox', icon: Inbox },
              { label: 'Connect a mailbox', to: '/app/mailboxes', icon: Mail },
            ].map(a => (
              <Link key={a.label} href={a.to} className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-muted/60 hover:bg-muted text-sm font-medium text-foreground transition-colors">
                <span className="flex items-center gap-3"><a.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />{a.label}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <div className="neu-card rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent campaigns</h2>
            <Link href="/app/campaigns" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {activeCampaigns.map(c => (
              <div key={c.id} className="py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.emailsSent.toLocaleString()} sent · {c.replies} replies</p>
                </div>
                <CampaignStatusBadge status={c.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="neu-card rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Mailbox status</h2>
          <div className="space-y-3">
            {mailboxes.map(m => (
              <div key={m.id} className="flex items-center gap-3">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', mailboxDot[m.status])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{m.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.status} · {m.sentToday}/{m.dailyLimit} today</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="neu-card rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Recent activity</h2>
          <ul className="space-y-3">
            {activity.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', a.dot)} />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{a.text}</p>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/50">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="font-semibold text-foreground">AI recommendations</h2>
          </div>
          <ul className="space-y-3">
            {recommendations.map((r, i) => (
              <li key={i} className="text-sm text-foreground leading-relaxed pl-3 border-l-2 border-blue-400">{r}</li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground mt-4">Suggestions are derived from your workspace signals. They describe good practice and do not guarantee inbox placement.</p>
        </div>
      </div>
    </div>
  );
}
