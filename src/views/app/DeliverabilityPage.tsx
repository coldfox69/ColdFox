'use client';

import { useState } from 'react';
import { Shield, RefreshCw, Plus, Trash2, Loader2, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { useRouter } from 'next/navigation';

export interface DeliverabilityData {
  domains: Array<{
    id: string;
    domain: string;
    status: string;
    spfStatus: string;
    dkimStatus: string;
    dmarcStatus: string;
    dkimSelector: string;
    lastCheckedAt: string;
  }>;
  checks: Array<{
    id: string;
    domainId: string;
    type: string;
    status: string;
    found: string;
    expected: string;
    checkedAt: string;
  }>;
}

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  verified: 'success',
  not_configured: 'muted',
  invalid: 'danger',
  unable_to_verify: 'warning',
  needs_attention: 'warning',
};

const statusLabel: Record<string, string> = {
  verified: 'Verified',
  not_configured: 'Not set',
  invalid: 'Invalid',
  unable_to_verify: 'Unverified',
  needs_attention: 'Needs work',
};

const label = (value: string) => statusLabel[value] ?? value;

export default function DeliverabilityPage({ data }: { data: DeliverabilityData }) {
  const toast = useToast();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const filtered = data.domains.filter(
    d => !query.trim() || d.domain.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const invalidDomains = data.domains.filter(d => [d.spfStatus, d.dkimStatus, d.dmarcStatus].some(s => s !== 'verified')).length;

  const addDomain = async (event: React.FormEvent) => {
    event.preventDefault();
    const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) {
      setFormError('Enter a domain, for example acme.com.');
      return;
    }
    setFormError('');
    setAdding(true);
    try {
      await apiFetch('/api/deliverability', { method: 'POST', body: JSON.stringify({ domain }) });
      toast.show(`${domain} added. DNS records were checked.`, 'success');
      setNewDomain('');
      router.refresh();
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setAdding(false);
    }
  };

  const checkDomain = async (domain: DeliverabilityData['domains'][number]) => {
    setChecking(domain.id);
    try {
      await apiFetch('/api/deliverability', {
        method: 'POST',
        body: JSON.stringify({ domain: domain.domain, dkim_selector: domain.dkimSelector || undefined }),
      });
      toast.show(`DNS check completed for ${domain.domain}.`, 'success');
      router.refresh();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setChecking(null);
    }
  };

  const removeDomain = async (id: string) => {
    setRemoving(id);
    try {
      await apiFetch(`/api/deliverability?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setConfirmId(null);
      toast.show('Domain removed.', 'success');
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
        title="Deliverability"
        description="Check the DNS records that prove your email is legitimate. A check reports what is published; it cannot guarantee inbox placement."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: 'SPF', text: 'Lists the servers allowed to send email for your domain.' },
          { key: 'DKIM', text: 'Adds a cryptographic signature that receivers can verify.' },
          { key: 'DMARC', text: 'Tells receivers what to do when a message fails those checks.' },
        ].map(item => (
          <div key={item.key} className="rounded-[12px] border border-border bg-card px-4 py-3">
            <p className="text-[12px] font-semibold text-accent-foreground">{item.key}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>

      <section className="neu-card rounded-[16px] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground">Add a sending domain</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Use the domain in the From address of your campaigns, for example acme.com.</p>
          </div>
          <form onSubmit={addDomain} className="flex w-full gap-2 md:w-auto">
            <input
              value={newDomain}
              onChange={e => { setNewDomain(e.target.value); setFormError(''); }}
              placeholder="acme.com"
              aria-label="Domain to add"
              className="min-w-0 flex-1 rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 md:w-56"
            />
            <button type="submit" disabled={adding} className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-60">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {adding ? 'Checking…' : 'Add domain'}
            </button>
          </form>
        </div>
        {formError && <p role="alert" className="mt-3 text-[12px] text-destructive">{formError}</p>}
      </section>

      {data.domains.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search domains" aria-label="Search domains" className="w-full rounded-[10px] border border-border bg-input py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15" />
          </div>
          <p className="text-[12px] text-muted-foreground">
            {invalidDomains === 0 ? 'All checked domains look healthy.' : `${invalidDomains} domain${invalidDomains === 1 ? '' : 's'} need attention.`}
          </p>
        </div>
      )}

      {data.domains.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          <EmptyState
            icon={<Shield className="h-6 w-6" />}
            title="No sending domains yet"
            description="Add the domain you send from to check its SPF, DKIM, and DMARC records."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          <EmptyState icon={<Search className="h-6 w-6" />} title="No domains match" description="Try a different search term." size="sm" />
        </div>
      ) : (
        <div className="neu-card overflow-x-auto rounded-[16px]">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Domain</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">SPF</th>
                <th className="px-4 py-3 text-center font-semibold">DKIM</th>
                <th className="px-4 py-3 text-center font-semibold">DMARC</th>
                <th className="px-4 py-3 text-center font-semibold">Checked</th>
                <th className="px-4 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(d => (
                <tr key={d.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <p className="truncate font-medium text-foreground">{d.domain}</p>
                    {d.dkimSelector && <p className="text-[12px] text-muted-foreground">DKIM selector: {d.dkimSelector}</p>}
                  </td>
                  <td className="px-4 py-3 text-center"><StatusBadge variant={statusVariant[d.status] ?? 'muted'}>{label(d.status)}</StatusBadge></td>
                  <td className="px-4 py-3 text-center"><StatusBadge variant={statusVariant[d.spfStatus] ?? 'muted'} size="sm">{label(d.spfStatus)}</StatusBadge></td>
                  <td className="px-4 py-3 text-center"><StatusBadge variant={statusVariant[d.dkimStatus] ?? 'muted'} size="sm">{label(d.dkimStatus)}</StatusBadge></td>
                  <td className="px-4 py-3 text-center"><StatusBadge variant={statusVariant[d.dmarcStatus] ?? 'muted'} size="sm">{label(d.dmarcStatus)}</StatusBadge></td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{d.lastCheckedAt ? d.lastCheckedAt.slice(0, 10) : 'Never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => void checkDomain(d)} disabled={checking === d.id} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-accent-foreground hover:bg-muted disabled:opacity-50">
                        {checking === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check
                      </button>
                      {confirmId === d.id ? (
                        <span className="flex items-center gap-1">
                          <button onClick={() => void removeDomain(d.id)} disabled={removing === d.id} className="rounded-md bg-destructive px-2 py-1 text-[12px] font-medium text-destructive-foreground disabled:opacity-50">{removing === d.id ? 'Removing…' : 'Confirm'}</button>
                          <button onClick={() => setConfirmId(null)} className="rounded-md border border-border px-2 py-1 text-[12px] font-medium">Keep</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(d.id)} aria-label={`Remove ${d.domain}`} className="rounded-lg p-1.5 text-destructive hover:bg-muted"><Trash2 className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.checks.length > 0 && (
        <section className="neu-card rounded-[16px]">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <CheckCircle2 className="h-4 w-4 text-[var(--cf-success)]" />
            <h2 className="text-[15px] font-semibold text-foreground">Recent DNS checks</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                  <th className="px-5 py-2.5 font-semibold">Type</th>
                  <th className="px-5 py-2.5 text-center font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold">Record found</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.checks.slice(0, 20).map(c => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium text-foreground">{c.type.toUpperCase()}</td>
                    <td className="px-5 py-3 text-center"><StatusBadge variant={statusVariant[c.status] ?? 'muted'} size="sm">{label(c.status)}</StatusBadge></td>
                    <td className="max-w-xs truncate px-5 py-3 font-mono text-[12px] text-muted-foreground">{c.found || '-'}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{c.checkedAt.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {invalidDomains > 0 && (
        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cf-warning)]" />
          Publish the missing records with your DNS provider, then run Check again. Changes can take a few minutes to propagate.
        </p>
      )}
    </div>
  );
}
