'use client';

import { useState } from 'react';
import { Shield, Globe, RefreshCw, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';

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

export default function DeliverabilityPage({ data }: { data: DeliverabilityData }) {
  const toast = useToast();
  const [query, setQuery] = useState('');

  const filtered = data.domains.filter(
    (d) => !query || d.domain.toLowerCase().includes(query.toLowerCase()),
  );

  const checkDomain = async (domain: (typeof filtered)[number]) => {
    try {
      await apiFetch('/api/deliverability', {
        method: 'POST',
        body: JSON.stringify({ domain: domain.domain, dkim_selector: domain.dkimSelector || undefined }),
      });
      toast.show(`DNS check completed for ${domain.domain}.`, 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  const removeDomain = async (id: string) => {
    if (!window.confirm('Remove this domain?')) return;
    try {
      await apiFetch(`/api/deliverability?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast.show('Domain removed.', 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Deliverability"
        description="Monitor SPF, DKIM, DMARC, and sending domain health."
        actions={
          <div className="flex gap-2">
            <input
              id="domain-input"
              placeholder="your-domain.com"
              className="px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => {
                const el = document.getElementById('domain-input') as HTMLInputElement | null;
                if (!el?.value) return toast.show('Enter a domain.', 'danger');
                void checkDomain({ ...filtered[0], domain: el.value, dkimSelector: '' } as any);
              }}
              disabled={!query}
              className="px-4 py-2.5 rounded-xl gradient-blue text-white text-sm font-semibold hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Add domain
            </button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground">
        SPF, DKIM, and DMARC are DNS records that help receiving providers verify your mail. A lookup confirms what is published; it does not guarantee inbox placement.
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Shield className="w-6 h-6" />}
          title="No sending domains"
          description="Add a sending domain to check its authentication records."
        />
      ) : (
        <div className="neu-card rounded-2xl mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-center">SPF</th>
                <th className="px-4 py-3 font-medium text-center">DKIM</th>
                <th className="px-4 py-3 font-medium text-center">DMARC</th>
                <th className="px-4 py-3 font-medium text-center">Checked</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate">{d.domain}</p>
                    {d.dkimSelector && <p className="text-xs text-muted-foreground">DKIM selector: {d.dkimSelector}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge variant={statusVariant[d.status] ?? 'muted'}>{d.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge variant={statusVariant[d.spfStatus] ?? 'muted'} size="sm">{d.spfStatus}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge variant={statusVariant[d.dkimStatus] ?? 'muted'} size="sm">{d.dkimStatus}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge variant={statusVariant[d.dmarcStatus] ?? 'muted'} size="sm">{d.dmarcStatus}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-center">{d.lastCheckedAt ? d.lastCheckedAt.slice(0, 10) : 'Never'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => void checkDomain(d)}
                      className="p-1.5 rounded-lg hover:bg-muted text-blue-600"
                      aria-label={`Check ${d.domain}`}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void removeDomain(d.id)}
                      className="ml-2 p-1.5 rounded-lg hover:bg-muted text-red-600"
                      aria-label={`Remove ${d.domain}`}
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

      {data.checks.length > 0 && (
        <div className="neu-card rounded-2xl mt-4">
          <h2 className="font-semibold text-foreground mb-4">Recent DNS checks</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium text-center">Status</th>
                  <th className="px-4 py-3 font-medium">Record found</th>
                  <th className="px-4 py-3 font-medium text-right">Checked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.checks.slice(0, 20).map((c) => (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-foreground">{c.type.toUpperCase()}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge variant={statusVariant[c.status] ?? 'muted'} size="sm">{c.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs truncate max-w-xs">{c.found || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-right">{c.checkedAt.slice(0, 16).replace('T', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
