'use client';

import { useState } from 'react';
import { Ban, Mail, Plus, Trash2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { useDebouncedValue } from '@/hooks/use-debounce';


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

export default function SuppressionPage({ data }: { data: SuppressionData }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('manual');
  const [newNotes, setNewNotes] = useState('');

  const filtered = data.entries.filter(
    (e) => !debouncedQuery || e.email.toLowerCase().includes(debouncedQuery.toLowerCase()) || e.reason.toLowerCase().includes(debouncedQuery.toLowerCase()),
  );

  const addSuppression = async () => {
    if (!newEmail) return toast.show('Enter an email address.', 'danger');
    try {
      await apiFetch('/api/suppression', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail, reason_key: newReason, notes: newNotes || undefined }),
      });
      toast.show(`Suppressed ${newEmail}.`, 'success');
      setNewEmail('');
      setNewNotes('');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this suppression entry? The address may receive emails again.')) return;
    try {
      await apiFetch(`/api/suppression?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast.show('Suppression entry removed.', 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto space-y-6">
      <PageHeader
        title="Suppression List"
        description="Unsubscribes, hard bounces, and complaints. Suppressed addresses are excluded from future sends."
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 neu-card rounded-[16px] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <input
                id="supp-email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                aria-label="Email address"
                className="flex-1 px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <select
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                aria-label="Reason"
                className="px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {data.reasons.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input
                id="supp-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notes (optional)"
                aria-label="Notes"
                className="flex-1 px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <button
              onClick={() => void addSuppression()}
              disabled={!newEmail}
              className="px-4 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search suppression entries"
              aria-label="Search suppression"
              className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-input py-2 pl-9 pr-3 text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            />
            <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <div className="neu-card rounded-[16px] p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Suppression reasons</h3>
          <ul className="space-y-2 text-sm">
            {data.reasons.map((r) => (
              <li key={r.key} className="flex justify-between">
                <span className="text-foreground">{r.label}</span>
                <span className="text-[12px] text-muted-foreground">{r.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Ban className="w-6 h-6" />}
          title="No suppressed addresses"
          description="Addresses that unsubscribe or hard-bounce appear here automatically."
        />
      ) : (
        <div className="neu-card rounded-[16px] mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium text-right">Added</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate">{e.email}</p>
                    {e.notes && <p className="text-[12px] text-muted-foreground">{e.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-foreground">{e.reason}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.source}</td>
                  <td className="px-4 py-3 text-muted-foreground text-right">{e.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void remove(e.id)}
                      className="p-1.5 rounded-lg hover:bg-muted text-destructive"
                      aria-label={`Remove ${e.email}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[12px] text-muted-foreground mt-4">
        Hard bounces and spam complaints are added automatically. Manual entries require owner or admin role.
      </p>
    </div>
  );
}
