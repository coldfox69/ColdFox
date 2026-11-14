'use client';

import { useState } from 'react';
import { Plus, RefreshCw, Plug, Zap, Trash2, Mail } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { ProviderMark } from '@/components/brand/BrandLogo';
import { useToast } from '@/components/shared/ToastProvider';
import { ConnectMailboxWizard, type MailboxConnectInput } from '@/components/mailbox/ConnectMailboxWizard';
import { type MailboxVM as Mailbox, type MailboxStatus } from '@/lib/view-models';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useRouter } from 'next/navigation';

const statusVariant: Record<MailboxStatus, 'success' | 'danger' | 'info' | 'muted'> = {
  connected: 'success',
  error: 'danger',
  syncing: 'info',
  disconnected: 'muted',
};

const providerLabel: Record<Mailbox['provider'], string> = { gmail: 'Gmail', outlook: 'Outlook', smtp: 'SMTP / IMAP' };

const reputationVariant: Record<Mailbox['reputation'], 'success' | 'info' | 'warning' | 'danger' | 'muted'> = {
  excellent: 'success',
  good: 'info',
  fair: 'warning',
  poor: 'danger',
  unknown: 'muted',
};

export default function MailboxesPage({
  initialMailboxes,
  providers = { gmail: false, outlook: false },
}: {
  initialMailboxes: Mailbox[];
  providers?: { gmail: boolean; outlook: boolean };
}) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Mailbox[]>(initialMailboxes);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const update = (id: string, patch: Partial<Mailbox>) =>
    setItems(list => list.map(m => (m.id === id ? { ...m, ...patch } : m)));

  const test = async (m: Mailbox) => {
    setBusy(m.id);
    try {
      const result = await apiFetch<{ ok: boolean; detail?: string }>(`/api/mailboxes/${m.id}/test`, { method: 'POST' });
      update(m.id, { status: 'connected', lastSync: 'Just now', lastError: null });
      toast.show(result.detail ? `${m.email}: ${result.detail}` : `Connection to ${m.email} is healthy.`, 'success');
      router.refresh();
    } catch (error) {
      update(m.id, { status: 'error', lastError: errorMessage(error) });
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const toggleWarmup = async (m: Mailbox) => {
    const next = !m.warmupEnabled;
    update(m.id, { warmupEnabled: next });
    try {
      await apiFetch(`/api/mailboxes/${m.id}`, { method: 'PATCH', body: JSON.stringify({ warmup_enabled: next }) });
    } catch (error) {
      update(m.id, { warmupEnabled: !next });
      toast.show(errorMessage(error), 'danger');
    }
  };

  const reconnect = (m: Mailbox) => {
    if (m.provider === 'gmail' || m.provider === 'outlook') {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/api/mailboxes/oauth/${m.provider}/start?sender_name=${encodeURIComponent(m.displayName || '')}`);
      return;
    }
    setWizardOpen(true);
  };

  const disconnect = async (m: Mailbox) => {    setBusy(m.id);
    try {
      await apiFetch(`/api/mailboxes/${m.id}`, { method: 'DELETE' });
      update(m.id, { status: 'disconnected' });
      setConfirmId(null);
      toast.show(`${m.email} disconnected.`, 'info');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const addMailbox = async (input: MailboxConnectInput) => {
    if (input.provider === 'gmail' || input.provider === 'outlook') {
      // The OAuth flow needs a full page navigation to the provider.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/api/mailboxes/oauth/${input.provider}/start?sender_name=${encodeURIComponent(input.senderName)}`);
      return;
    }
    if (!input.host || !input.password) throw new Error('Enter the server host and password.');
    await apiFetch('/api/mailboxes', {
      method: 'POST',
      body: JSON.stringify({
        email_address: input.email,
        provider: 'smtp',
        host: input.host,
        port: input.port || 587,
        secure: (input.port || 587) === 465,
        username: input.username || input.email,
        password: input.password,
        imap_host: input.imapHost,
        imap_port: input.imapPort,
        display_name: input.senderName,
        daily_limit: 100,
      }),
    });
    setWizardOpen(false);
    toast.show(`${input.email} connected. Sending as ${input.senderName}.`, 'success');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Mailboxes"
        description="Sending accounts for your campaigns. Keep daily limits conservative and watch their health."
        actions={
          <button onClick={() => setWizardOpen(true)} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
            <Plus className="h-4 w-4" /> Connect mailbox
          </button>
        }
      />

      {items.some(m => m.status !== 'connected') && (
        <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3">
          <RefreshCw className="h-4 w-4 shrink-0 text-[var(--warning)]" />
          <p className="min-w-0 flex-1 text-[13px] text-foreground">
            {items.filter(m => m.status !== 'connected').length} mailbox{items.filter(m => m.status !== 'connected').length === 1 ? '' : 'es'} cannot send right now. Reconnect before starting a campaign.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          <EmptyState
            icon={<Mail className="h-6 w-6" />}
            title="No mailboxes connected"
            description="Connect a Gmail, Outlook, or SMTP account to start sending. You can add more than one later."
            action={<button onClick={() => setWizardOpen(true)} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground">Connect mailbox</button>}
          />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {items.map(m => {
            const pct = Math.min(100, Math.round((m.sentToday / m.dailyLimit) * 100));
            return (
              <article key={m.id} className="neu-card flex flex-col gap-4 rounded-[16px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="icon-tile h-10 w-10 shrink-0 rounded-[10px]">
                      <ProviderMark provider={m.provider} size={22} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-foreground">{m.email}</p>
                      <p className="text-[12px] text-muted-foreground">{providerLabel[m.provider]}{m.displayName ? ` · Sending as ${m.displayName}` : ''} · Last sync {m.lastSync}</p>
                    </div>
                  </div>
                  <StatusBadge variant={statusVariant[m.status]}>{m.status === 'connected' ? 'Connected' : 'Needs attention'}</StatusBadge>
                </div>

                <div>
                  <div className="mb-1.5 flex justify-between text-[12px] text-muted-foreground">
                    <span>Sent today</span>
                    <span className="tabular-nums">{m.sentToday} / {m.dailyLimit}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={m.dailyLimit} aria-valuenow={m.sentToday} aria-label={`Daily send usage for ${m.email}`}>
                    <div className={cn('h-full rounded-full transition-[width] duration-[var(--dur-slow)] ease-[var(--ease)]', pct >= 100 ? 'bg-[var(--danger)]' : pct >= 90 ? 'bg-[var(--warning)]' : 'bg-primary')} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[12px]">
                  <span className="text-muted-foreground">Health</span>
                  <StatusBadge variant={reputationVariant[m.reputation]} size="sm">{m.reputation}</StatusBadge>
                  <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
                    <span>Warm-up</span>
                    <button
                      role="switch"
                      aria-checked={m.warmupEnabled}
                      aria-label={`Warm-up for ${m.email}`}
                      onClick={() => void toggleWarmup(m)}
                      className={cn('relative h-5 w-9 rounded-full transition-colors', m.warmupEnabled ? 'bg-[var(--success)]' : 'bg-muted-foreground/30')}
                    >
                      <span className={cn('absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform', m.warmupEnabled && 'translate-x-4')} />
                    </button>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <button onClick={() => void test(m)} disabled={busy === m.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">
                    <Zap className="h-3.5 w-3.5" /> {busy === m.id ? 'Testing…' : 'Test connection'}
                  </button>
                  {m.status === 'error' && (
                    <button onClick={() => reconnect(m)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted">
                      <RefreshCw className="h-3.5 w-3.5" /> Reconnect
                    </button>
                  )}
                  {confirmId === m.id ? (
                    <div className="ml-auto flex items-center gap-2 text-[12px]">
                      <span className="text-muted-foreground">Disconnect this mailbox?</span>
                      <button onClick={() => void disconnect(m)} disabled={busy === m.id} className="rounded-lg bg-destructive px-2.5 py-1 font-medium text-destructive-foreground disabled:opacity-50">Yes, disconnect</button>
                      <button onClick={() => setConfirmId(null)} className="rounded-lg border border-border bg-card px-2.5 py-1 font-medium text-foreground hover:bg-muted">Keep</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(m.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors hover:bg-muted">
                      <Trash2 className="h-3.5 w-3.5" /> Disconnect
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="space-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
        <p className="flex items-start gap-1.5"><Plug className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Gmail and Outlook connect with OAuth. SMTP credentials are encrypted at rest and never returned to the browser.</p>
        <p className="flex items-start gap-1.5"><Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Warm-up raises daily volume gradually so a new mailbox builds a sending history. Keep limits conservative.</p>
      </div>

      {wizardOpen && <ConnectMailboxWizard onClose={() => setWizardOpen(false)} onConnect={addMailbox} configured={providers} />}
    </div>
  );
}
