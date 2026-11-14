'use client';

import { useState } from 'react';
import { Ban, Plus, Trash2, AlertCircle, Search, Loader2, ShieldOff, Info } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useRouter } from 'next/navigation';

export interface SuppressionData {
  entries: Array<{
    id: string;
    email: string;
    reasonKey: string;
    reason: string;
    source: string;
    notes: string;
    createdAt: string;
  }>;
  reasons: Array<{ key: string; label: string; description: string }>;
}

const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:opacity-60';

export default function SuppressionPage({ data }: { data: SuppressionData }) {
  const toast = useToast();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState(data.reasons[0]?.key ?? 'manual');
  const [newNotes, setNewNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const filtered = data.entries.filter(
    (e) => !debouncedQuery || e.email.toLowerCase().includes(debouncedQuery.toLowerCase()) || e.reason.toLowerCase().includes(debouncedQuery.toLowerCase()),
  );

  const addSuppression = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Enter a valid email address, for example person@company.com.');
      return;
    }
    setFormError('');
    setAdding(true);
    try {
      await apiFetch('/api/suppression', {
        method: 'POST',
        body: JSON.stringify({ email, reason_key: newReason, notes: newNotes.trim() || undefined }),
      });
      toast.show(`${email} will not receive any more email.`, 'success');
      setNewEmail('');
      setNewNotes('');
      router.refresh();
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await apiFetch(`/api/suppression?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setConfirmId(null);
      toast.show('Address removed from the suppression list.', 'success');
      router.refresh();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Suppression list"
        description="Addresses that must never receive email from this workspace. Unsubscribes and hard bounces are added automatically."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <form onSubmit={addSuppression} className="neu-card rounded-[16px] p-5 lg:col-span-2">
          <h2 className="text-[15px] font-semibold text-foreground">Add an address</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Use this for do-not-contact requests that did not come through an unsubscribe link.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label htmlFor="supp-email" className="mb-1.5 block text-[13px] font-medium text-foreground">Email address</label>
              <input
                id="supp-email"
                type="email"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setFormError(''); }}
                placeholder="person@company.com"
                className={inputCls}
                required
              />
            </div>
            <div>
              <label htmlFor="supp-reason" className="mb-1.5 block text-[13px] font-medium text-foreground">Reason</label>
              <select id="supp-reason" value={newReason} onChange={(e) => setNewReason(e.target.value)} className={inputCls}>
                {data.reasons.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="supp-notes" className="mb-1.5 block text-[13px] font-medium text-foreground">Note <span className="font-normal text-muted-foreground">(optional)</span></label>
              <input
                id="supp-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Where the request came from"
                className={inputCls}
              />
            </div>
          </div>
          {formError && <p role="alert" className="mt-3 text-[12px] text-destructive">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={adding || !newEmail.trim()} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-50">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {adding ? 'Adding…' : 'Add to suppression list'}
            </button>
          </div>
        </form>

        <section className="neu-card rounded-[16px] p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><ShieldOff className="h-4 w-4 text-muted-foreground" /> What is blocked</h2>
          <ul className="mt-3 space-y-2.5">
            {data.reasons.map((r) => (
              <li key={r.key}>
                <p className="text-[13px] font-medium text-foreground">{r.label}</p>
                <p className="text-[12px] leading-relaxed text-muted-foreground">{r.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email or reason"
            aria-label="Search suppression list"
            className="w-full rounded-[10px] border border-border bg-input py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15"
          />
        </div>
        <p className="text-[12px] text-muted-foreground">
          {data.entries.length === 0 ? 'No addresses blocked yet' : `${filtered.length} of ${data.entries.length} addresses shown`}
        </p>
      </div>

      {data.entries.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          <EmptyState
            icon={<Ban className="h-6 w-6" />}
            title="Nothing suppressed yet"
            description="When someone unsubscribes or an address hard-bounces, it is added here automatically and excluded from every future send."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          <EmptyState
            size="sm"
            icon={<Search className="h-5 w-5" />}
            title="No matches"
            description={`Nothing matches “${query}”.`}
            action={<button onClick={() => setQuery('')} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">Clear search</button>}
          />
        </div>
      ) : (
        <div className="neu-card overflow-hidden rounded-[16px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Source</th>
                  <th className="px-4 py-3 text-right font-semibold">Added</th>
                  <th className="px-4 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <p className="truncate font-medium text-foreground">{e.email}</p>
                      {e.notes && <p className="text-[12px] text-muted-foreground">{e.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-foreground">{e.reason}</td>
                    <td className="hidden px-4 py-3 capitalize text-muted-foreground md:table-cell">{e.source.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{e.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        {confirmId === e.id ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground">Allow again?</span>
                            <button onClick={() => void remove(e.id)} disabled={removing === e.id} className="rounded-md bg-destructive px-2 py-1 text-[11px] font-medium text-destructive-foreground disabled:opacity-50">
                              {removing === e.id ? 'Removing…' : 'Confirm'}
                            </button>
                            <button onClick={() => setConfirmId(null)} className="rounded-md border border-border px-2 py-1 text-[11px] font-medium">Keep</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmId(e.id)}
                            className="rounded-lg p-1.5 text-destructive hover:bg-muted"
                            aria-label={`Remove ${e.email} from suppression`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Hard bounces and spam complaints are added automatically and should normally stay suppressed. Removing an entry allows future campaigns to contact that address again.
      </p>
    </div>
  );
}
