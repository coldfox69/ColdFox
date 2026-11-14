'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Pause, Play, Copy, Ban, Loader2, AlertTriangle, Pencil, Check, Inbox, BarChart2,
  Users, MailCheck, CalendarClock, MoreHorizontal, Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignStatusBadge, StatusBadge } from '@/components/shared/StatusBadge';
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

const btn = 'inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50';

const recipientVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'default'> = {
  queued: 'muted',
  active: 'info',
  sent: 'success',
  accepted: 'success',
  replied: 'info',
  bounced: 'danger',
  failed: 'danger',
  skipped: 'muted',
  unsubscribed: 'warning',
};

const recipientLabel: Record<string, string> = {
  queued: 'Queued',
  active: 'Sending',
  sent: 'Sent',
  accepted: 'Sent',
  replied: 'Replied',
  bounced: 'Bounced',
  failed: 'Failed',
  skipped: 'Skipped',
  unsubscribed: 'Unsubscribed',
};

export default function CampaignDetailPage({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

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
      setConfirmCancel(false);
      setMenuOpen(false);
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
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <p className="mb-5 text-[13px] text-muted-foreground">{error}</p>
        <Link href="/app/campaigns" className="text-[13px] font-medium text-accent-foreground hover:underline">Back to campaigns</Link>
      </div>
    );
  }

  if (!detail || !stats) {
    return <div className="flex items-center justify-center gap-3 px-6 py-16 text-[13px] text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading campaign…</div>;
  }

  const campaign = detail.campaign;
  const scheduled = campaign.launch_at ? new Date(campaign.launch_at) : null;
  const canCancel = ['active', 'paused', 'draft', 'scheduled'].includes(campaign.status);
  const kpis = [
    { label: 'Recipients', value: stats.totalRecipients, tone: 'text-foreground' },
    { label: 'Queued / sending', value: stats.queued, tone: 'text-foreground' },
    { label: 'Sent', value: stats.sent, tone: 'text-[var(--cf-success)]' },
    { label: 'Replies', value: stats.replies, tone: 'text-accent-foreground' },
    { label: 'Bounces', value: stats.bounces, tone: 'text-[var(--cf-warning)]' },
    { label: 'Unsubscribes', value: stats.unsubscribes, tone: 'text-[var(--cf-warning)]' },
    { label: 'Skipped', value: stats.skipped, tone: 'text-muted-foreground' },
    { label: 'Failed', value: stats.failed, tone: 'text-destructive' },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/app/campaigns" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to campaigns</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {editing ? (
              <span className="flex items-center gap-2">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void saveName(); if (e.key === 'Escape') setEditing(false); }}
                  className="rounded-[10px] border border-border bg-input px-3 py-1.5 text-[20px] font-semibold outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15"
                  aria-label="Campaign name"
                />
                <button type="button" onClick={() => void saveName()} aria-label="Save name" className="rounded-lg p-1.5 hover:bg-muted"><Check className="h-5 w-5 text-[var(--cf-success)]" /></button>
              </span>
            ) : (
              <h1 className="flex items-center gap-2 text-[24px] font-semibold tracking-[-0.025em] text-foreground">
                {campaign.name}
                <button type="button" aria-label="Rename campaign" onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
              </h1>
            )}
            <CampaignStatusBadge status={status} />
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {campaign.description || 'One template, one lead list, one mailbox.'}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {scheduled ? <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Scheduled for {scheduled.toLocaleString()} ({campaign.timezone})</span> : null}
            {campaign.started_at && !['active', 'scheduled', 'paused'].includes(campaign.status) ? ` · Started ${new Date(campaign.started_at).toLocaleString()}` : null}
            {campaign.completed_at ? ` · Completed ${new Date(campaign.completed_at).toLocaleString()}` : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status === 'draft' && (
            <button type="button" onClick={() => void launch()} disabled={busy === 'launch'} className={cn(btn, 'bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-105')}>
              {busy === 'launch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Launch now
            </button>
          )}
          {status === 'active' && (
            <button type="button" onClick={() => void pause()} disabled={busy === 'pause'} className={cn(btn, 'border border-border bg-card text-foreground hover:bg-muted')}>
              {busy === 'pause' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />} Pause sending
            </button>
          )}
          {status === 'paused' && (
            <button type="button" onClick={() => void resume()} disabled={busy === 'resume'} className={cn(btn, 'bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-105')}>
              {busy === 'resume' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Resume sending
            </button>
          )}

          <div className="relative">
            <button type="button" onClick={() => setMenuOpen(v => !v)} aria-expanded={menuOpen} aria-haspopup="menu" className={cn(btn, 'border border-border bg-card text-foreground hover:bg-muted')}>
              <MoreHorizontal className="h-4 w-4" /> More
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div role="menu" className="absolute right-0 top-11 z-30 w-52 rounded-[12px] border border-border bg-popover py-1 shadow-[var(--shadow-raised-lg)]">
                  <button role="menuitem" onClick={() => void duplicate()} disabled={busy === 'duplicate'} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted disabled:opacity-50">
                    {busy === 'duplicate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Duplicate as draft
                  </button>
                  <Link role="menuitem" href="/app/analytics" className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-muted">
                    <BarChart2 className="h-4 w-4" /> Open analytics
                  </Link>
                  {canCancel && (
                    <>
                      <div className="my-1 border-t border-border" />
                      <button role="menuitem" onClick={() => { setMenuOpen(false); setConfirmCancel(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-destructive hover:bg-muted">
                        <Ban className="h-4 w-4" /> Cancel campaign
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {confirmCancel && (
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="min-w-0 flex-1 text-[13px] text-foreground">Cancel <strong>{campaign.name}</strong>? Sending stops immediately and queued recipients are dropped.</p>
          <button type="button" onClick={() => void cancel()} disabled={busy === 'cancel'} className="rounded-lg bg-destructive px-3 py-1.5 text-[12px] font-medium text-destructive-foreground disabled:opacity-50">
            {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}
          </button>
          <button type="button" onClick={() => setConfirmCancel(false)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted">Keep</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((card) => (
          <div key={card.label} className="neu-card rounded-[16px] p-4">
            <p className="text-[12px] text-muted-foreground">{card.label}</p>
            <p className={cn('mt-1 text-[24px] font-semibold leading-none tabular-nums', card.tone)}>{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <section className="neu-card rounded-[16px] p-5">
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><Users className="h-4 w-4 text-primary" /> Progress</p>
          <p className="text-[13px] font-medium text-muted-foreground tabular-nums">{stats.progress}% complete</p>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={stats.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Campaign completion">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, stats.progress))}%` }} />
        </div>
        {Object.keys(stats.variants).length > 0 && (
          <p className="mt-3 text-[12px] text-muted-foreground">
            Variant split: {Object.entries(stats.variants).map(([id, count]) => `${variantLabel(id)}: ${count}`).join(' · ')}
          </p>
        )}
        {status === 'draft' && (
          <p className="mt-3 rounded-[10px] bg-muted px-3 py-2 text-[12px] text-muted-foreground">
            This campaign is a draft. Nothing has been sent. Launch now sends immediately using the assigned mailbox and daily limit.
          </p>
        )}
      </section>

      <section className="neu-card overflow-hidden rounded-[16px]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Inbox className="h-4 w-4 text-primary" /> Recipient activity
            <span className="font-normal text-muted-foreground">({detail.leads.length.toLocaleString()})</span>
          </h2>
          <p className="text-[12px] text-muted-foreground">Showing the first 200 recipients</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Recipient</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Variant</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">Sent</th>
                <th className="px-4 py-3 font-semibold">Last error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {detail.leads.slice(0, 200).map((row) => {
                const execution = executionByLead.get(row.lead?.id ?? '') ?? null;
                const rowError = row.error ?? execution?.error ?? null;
                return (
                  <tr key={row.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.lead?.email ?? '—'}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {[row.lead?.first_name, row.lead?.last_name].filter(Boolean).join(' ') || 'No name'}
                        {row.lead?.company_name ? ` · ${row.lead.company_name}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={recipientVariant[row.status] ?? 'default'} size="sm">
                        {recipientLabel[row.status] ?? row.status.replace(/_/g, ' ')}
                      </StatusBadge>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{variantLabel(execution?.variant_id ?? null)}</td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {row.last_sent_at ? new Date(row.last_sent_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : execution?.finished_at ? new Date(execution.finished_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      {rowError ? (
                        <span className="block truncate text-[12px] text-destructive" title={rowError}>{rowError}</span>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {detail.leads.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center">
                    <p className="text-[13px] font-medium text-foreground">No recipients queued yet</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {status === 'draft' ? 'Launch the campaign to queue one email per recipient.' : 'Recipients appear here as the campaign is prepared.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <MailCheck className="h-3.5 w-3.5" /> Provider acceptance is recorded per recipient. Bounces and replies are detected by the inbox sync and shown here automatically.
      </p>
    </div>
  );
}
