'use client';

import { useState } from 'react';
import { Plus, RefreshCw, Plug, Zap, Trash2, Mail } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
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

  const disconnect = async (m: Mailbox) => {
    setBusy(m.id);
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
      window.location.href = `/api/mailboxes/oauth/${input.provider}/start`;
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
        username: input.email,
        password: input.password,
        daily_limit: 100,
      }),
    });
    setWizardOpen(false);
    toast.show(`${input.email} connected.`, 'success');
    router.refresh();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Mailboxes"
        description="Sending accounts used for your campaigns. Keep daily limits conservative and watch their health."
        actions={
          <button onClick={() => setWizardOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-blue text-white text-sm font-semibold hover:opacity-90">
            <Plus className="w-4 h-4" /> Connect mailbox
          </button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<Mail className="w-8 h-8" />}
          title="No mailboxes connected"
          description="Connect a Gmail, Outlook, or SMTP account to start sending."
          action={<button onClick={() => setWizardOpen(true)} className="px-4 py-2 rounded-xl gradient-blue text-white text-sm font-semibold">Connect mailbox</button>}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {items.map(m => {
            const pct = Math.min(100, Math.round((m.sentToday / m.dailyLimit) * 100));
            return (
              <article key={m.id} className="neu-card rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{m.email}</p>
                      <p className="text-xs text-muted-foreground">{providerLabel[m.provider]} · Last sync {m.lastSync}</p>
                    </div>
                  </div>
                  <StatusBadge variant={statusVariant[m.status]}>{m.status}</StatusBadge>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Sent today</span>
                    <span>{m.sentToday} / {m.dailyLimit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={m.dailyLimit} aria-valuenow={m.sentToday}>
                    <div className="h-full rounded-full gradient-blue transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Health</span>
                  <StatusBadge variant={reputationVariant[m.reputation]} size="sm">{m.reputation}</StatusBadge>
                  <label className="ml-auto inline-flex items-center gap-2 text-muted-foreground cursor-pointer">
                    <span>Warm-up</span>
                    <button
                      role="switch"
                      aria-checked={m.warmupEnabled}
                      onClick={() => void toggleWarmup(m)}
                      className={cn('relative w-9 h-5 rounded-full transition-colors', m.warmupEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/30')}
                    >
                      <span className={cn('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform', m.warmupEnabled && 'translate-x-4')} />
                    </button>
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                  <button onClick={() => void test(m)} disabled={busy === m.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50">
                    <Zap className="w-3.5 h-3.5" /> {busy === m.id ? 'Testing…' : 'Test connection'}
                  </button>
                  {m.status === 'error' && (
                    <button onClick={() => void test(m)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted">
                      <RefreshCw className="w-3.5 h-3.5" /> Reconnect
                    </button>
                  )}
                  {confirmId === m.id ? (
                    <div className="flex items-center gap-2 ml-auto text-xs">
                      <span className="text-muted-foreground">Disconnect this mailbox?</span>
                      <button onClick={() => void disconnect(m)} disabled={busy === m.id} className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-medium disabled:opacity-50">Yes, disconnect</button>
                      <button onClick={() => setConfirmId(null)} className="px-2.5 py-1 rounded-lg border border-border font-medium">Keep</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(m.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 ml-auto">
                      <Trash2 className="w-3.5 h-3.5" /> Disconnect
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Plug className="w-3.5 h-3.5" /> Gmail and Outlook connections use OAuth when configured. SMTP credentials are encrypted at rest and never returned to the browser.
      </p>

      {wizardOpen && <ConnectMailboxWizard onClose={() => setWizardOpen(false)} onConnect={addMailbox} configured={providers} />}
    </div>
  );
}
