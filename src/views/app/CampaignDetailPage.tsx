'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Pause, Play, Copy, Ban, Loader2, AlertTriangle, Pencil, Check, Inbox, BarChart2,
  Users, MailCheck, CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignStatusBadge } from '@/components/shared/StatusBadge';
import { useToast } from '@/components/shared/ToastProvider';
import { apiFetch, errorMessage } from '@/lib/client/api';
import type { CampaignStatus } from '@/lib/view-models';

interface LeadRow {
  id: string;
  status: string;
  current_step: number;
  last_sent_at: string | null;
  next_send_at: string | null;
  error: string | null;
  lead: { id: string; first_name: string | null; last_name: string | null; email: string; company_name: string | null } | null;
}

interface ExecutionRow {
  id: string;
  status: string;
  variant_id: string | null;
  personalized?: boolean;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  provider_message_id: string | null;
  lead: { id: string; first_name: string | null; last_name: string | null; email: string } | null;
}

interface CampaignDetail {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    launch_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    timezone: string;
    daily_limit: number;
    template_id: string | null;
    total_leads: number;
    emails_sent: number;
    replies: number;
    bounces: number;
    unsubscribes: number;
  };
  leads: LeadRow[];
  executions: ExecutionRow[];
  variants: { id: string; variant_order: number; subject: string }[];
  stats: {
    totalRecipients: number;
    executions: number;
    queued: number;
    sent: number;
    accepted: number;
    skipped: number;
    failed: number;
    bounces: number;
    replies: number;
    unsubscribes: number;
    progress: number;
    variants: Record<string, number>;
  };
}

const statCard = 'neu-card rounded-[16px] p-4';
const btn = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-sm font-medium transition-colors disabled:opacity-50';

export default function CampaignDetailPage({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<CampaignDetail>(`/api/campaigns/${campaignId}`);
      setDetail(data);
      setName(data.campaign.name);
      setError('');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<CampaignDetail>(`/api/campaigns/${campaignId}`);
        if (cancelled) return;
        setDetail(data);
        setName(data.campaign.name);
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause));
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  // Poll while the campaign is live so the numbers stay fresh; each tick also drains the sending queue for this workspace.
  useEffect(() => {
    if (!detail) return;
    const live = ['active', 'scheduled'].includes(detail.campaign.status);
    if (!live) return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        try {
          await apiFetch(`/api/campaigns/send-due`, { method: 'POST', body: JSON.stringify({}) });
        } catch {
          // Ticking is best-effort; the next interval will retry.
        } finally {
          if (!cancelled) void load();
        }
      })();
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [detail, load]);

  const stats = detail?.stats;
  const status = (detail?.campaign.status ?? 'draft') as CampaignStatus;

  const executionByLead = useMemo(() => {
    const map = new Map<string, ExecutionRow>();
    for (const execution of detail?.executions ?? []) {
      const leadId = execution.lead?.id;
      if (leadId) map.set(leadId, execution);
    }
    return map;
  }, [detail?.executions]);

  const variantLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const variant of detail?.variants ?? []) map.set(variant.id, `Variant ${variant.variant_order}`);
    return (id: string | null) => (id ? map.get(id) ?? '—' : '—');
  }, [detail?.variants]);

  const cancel = async () => {
    setBusy('cancel');
    try {
      await apiFetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      toast.show('Campaign cancelled.', 'info');
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const pause = async () => {
    setBusy('pause');
    try {
      await apiFetch(`/api/campaigns/${campaignId}/pause`, { method: 'POST', body: JSON.stringify({}) });
      toast.show('Campaign paused.', 'success');
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const resume = async () => {
    setBusy('resume');
    try {
      await apiFetch(`/api/campaigns/${campaignId}/resume`, { method: 'POST', body: JSON.stringify({}) });
      toast.show('Campaign resumed.', 'success');
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const launch = async () => {
    setBusy('launch');
    try {
      await apiFetch(`/api/campaigns/${campaignId}/launch`, { method: 'POST', body: JSON.stringify({ mode: 'now' }) });
      toast.show('Campaign launched.', 'success');
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async () => {
    setBusy('duplicate');
    try {
      const copy = await apiFetch<{ id: string }>(`/api/campaigns/${campaignId}/duplicate`, { method: 'POST', body: JSON.stringify({}) });
      toast.show('Draft copy created.', 'success');
      router.push(`/app/campaigns/${copy.id}`);
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
      setBusy(null);
    }
  };

  const saveName = async () => {
    if (!name.trim() || name.trim() === detail?.campaign.name) { setEditing(false); return; }
    try {
      await apiFetch(`/api/campaigns/${campaignId}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) });
      toast.show('Campaign renamed.', 'success');
      setEditing(false);
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  if (error && !detail) {
    return (
      <div className="px-6 py-10 max-w-xl mx-auto text-center">
        <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-5">{error}</p>
        <Link href="/app/campaigns" className="text-sm font-medium text-accent-foreground hover:underline">Back to campaigns</Link>
      </div>
    );
  }

  if (!detail || !stats) {
    return <div className="px-6 py-10 flex items-center justify-center gap-3 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading campaign…</div>;
  }

  const campaign = detail.campaign;
  const scheduled = campaign.launch_at ? new Date(campaign.launch_at) : null;

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <Link href="/app/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Back to campaigns</Link>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {editing ? (
              <span className="flex items-center gap-2">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void saveName(); }} className="text-xl font-semibold bg-input rounded-[10px] px-3 py-1.5 outline-none focus:ring-2 focus:ring-ring" aria-label="Campaign name" />
                <button type="button" onClick={() => void saveName()} aria-label="Save name" className="p-1.5 rounded-lg hover:bg-muted"><Check className="w-5 h-5 text-[var(--cf-success)]" /></button>
              </span>
            ) : (
              <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
                {campaign.name}
                <button type="button" aria-label="Rename campaign" onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="w-4 h-4" /></button>
              </h1>
            )}
            <CampaignStatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {scheduled ? <span className="inline-flex items-center gap-1.5"><CalendarClock className="w-4 h-4" /> Scheduled for {scheduled.toLocaleString()} ({campaign.timezone})</span> : null}
            {campaign.started_at && !['active', 'scheduled', 'paused'].includes(campaign.status) ? ` · Started ${new Date(campaign.started_at).toLocaleString()}` : null}
            {campaign.completed_at ? ` · Completed ${new Date(campaign.completed_at).toLocaleString()}` : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === 'active' && <button type="button" onClick={() => void pause()} disabled={busy === 'pause'} className={cn(btn, 'bg-card text-foreground shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised)]')}>{busy === 'pause' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />} {busy === 'pause' ? 'Pausing…' : 'Pause'}</button>}
          {status === 'paused' && <button type="button" onClick={() => void resume()} disabled={busy === 'resume'} className={cn(btn, 'bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-110')}>{busy === 'resume' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Resume</button>}
          {status === 'draft' && <button type="button" onClick={() => void launch()} disabled={busy === 'launch'} className={cn(btn, 'bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-110')}>{busy === 'launch' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Launch</button>}
          <button type="button" onClick={() => void duplicate()} disabled={busy === 'duplicate'} className={cn(btn, 'bg-card text-foreground shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised)]')}>{busy === 'duplicate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Duplicate</button>
          {(status === 'active' || status === 'paused' || status === 'draft' || status === 'scheduled') && <button type="button" onClick={() => void cancel()} disabled={busy === 'cancel'} className={cn(btn, 'bg-destructive/10 text-destructive hover:bg-destructive/20')}>{busy === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Cancel</button>}
          <Link href="/app/analytics" className={cn(btn, 'bg-card text-foreground shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised)]')}><BarChart2 className="w-4 h-4" /> Analytics</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total recipients', value: stats.totalRecipients, tone: 'text-foreground' },
          { label: 'Queued / sending', value: stats.queued, tone: 'text-foreground' },
          { label: 'Sent (accepted)', value: stats.sent, tone: 'text-[var(--cf-success)]' },
          { label: 'Skipped', value: stats.skipped, tone: 'text-muted-foreground' },
          { label: 'Bounces', value: stats.bounces, tone: 'text-[var(--cf-warning)]' },
          { label: 'Replies', value: stats.replies, tone: 'text-accent-foreground' },
          { label: 'Unsubscribes', value: stats.unsubscribes, tone: 'text-[var(--cf-warning)]' },
          { label: 'Failed', value: stats.failed, tone: 'text-destructive' },
        ].map((card) => (
          <div key={card.label} className={statCard}>
            <p className="text-[12px] text-muted-foreground">{card.label}</p>
            <p className={cn('text-2xl font-semibold mt-1', card.tone)}>{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="neu-card rounded-[16px] p-5">
        <div className="flex items-center justify-between gap-4 mb-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Progress</p>
          <p className="text-sm font-medium text-muted-foreground">{stats.progress}% complete</p>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={stats.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Campaign completion">
          <div className="h-full bg-primary rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, stats.progress))}%` }} />
        </div>
        {Object.keys(stats.variants).length > 0 && (
          <p className="text-[12px] text-muted-foreground mt-3">
            Variant split: {Object.entries(stats.variants).map(([id, count]) => `${variantLabel(id)}: ${count}`).join(' · ')}
          </p>
        )}
      </div>

      <div className="neu-card rounded-[16px] overflow-x-auto">
        <div className="flex items-center justify-between gap-4 p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><Inbox className="w-4 h-4 text-primary" /> Recipient activity <span className="text-muted-foreground font-normal">({detail.leads.length})</span></h2>
        </div>
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="text-left text-[12px] text-muted-foreground border-b border-border">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Variant</th>
              <th className="px-4 py-3 font-medium">Sent</th>
              <th className="px-4 py-3 font-medium">Provider ID</th>
              <th className="px-4 py-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {detail.leads.slice(0, 200).map((row) => {
              const execution = executionByLead.get(row.lead?.id ?? '') ?? null;
              return (
                <tr key={row.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium text-foreground">{row.lead?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{[row.lead?.first_name, row.lead?.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-4 py-3 capitalize text-foreground">{row.status.replace(/_/g, ' ')}{row.status === 'replied' ? ' · replied' : ''}</td>
                  <td className="px-4 py-3 text-muted-foreground">{variantLabel(execution?.variant_id ?? null)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.last_sent_at ? new Date(row.last_sent_at).toLocaleString() : execution?.finished_at ? new Date(execution.finished_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-[11px] max-w-[140px] truncate" title={execution?.provider_message_id ?? undefined}>{execution?.provider_message_id ?? '—'}</td>
                  <td className="px-4 py-3 text-destructive text-[12px] max-w-[220px] truncate" title={row.error ?? execution?.error ?? undefined}>{row.error ?? execution?.error ?? '—'}</td>
                </tr>
              );
            })}
            {detail.leads.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No recipients queued yet. Launch the campaign to queue one job per recipient.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><MailCheck className="w-3.5 h-3.5" /> Provider acceptance is recorded per recipient. Bounces and replies are detected by the inbox sync and shown here automatically.</p>
    </div>
  );
}
