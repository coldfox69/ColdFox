'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Download, Trash2, X, ArrowUpDown, Users, Filter } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LeadStatusBadge } from '@/components/shared/StatusBadge';
import { type LeadStatus, type LeadVM as Lead } from '@/lib/view-models';
import { useToast } from '@/components/shared/ToastProvider';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useDebouncedValue } from '@/hooks/use-debounce';

const statusOptions: { value: LeadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'replied', label: 'Replied' },
  { value: 'interested', label: 'Interested' },
  { value: 'not-interested', label: 'Not interested' },
  { value: 'bounced', label: 'Bounced' },
];

type SortKey = 'name' | 'company' | 'lastContacted' | 'nextFollowUp';

export default function LeadsPage({ initialLeads }: { initialLeads: Lead[] }) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Lead[]>(initialLeads);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<LeadStatus | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const rows = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const value = (l: Lead): string => {
      switch (sort.key) {
        case 'name': return `${l.firstName} ${l.lastName}`;
        case 'company': return l.company;
        case 'lastContacted': return l.lastContacted ?? '';
        case 'nextFollowUp': return l.nextFollowUp ?? '';
      }
    };
    return items
      .filter(l => status === 'all' || l.status === status)
      .filter(l => !q || [l.firstName, l.lastName, l.email, l.company, l.jobTitle, ...l.tags].join(' ').toLowerCase().includes(q))
      .sort((a, b) => {
        const cmp = value(a).localeCompare(value(b));
        return sort.desc ? -cmp : cmp;
      });
  }, [items, debouncedQuery, status, sort]);

  const allSelected = rows.length > 0 && rows.every(l => selected.has(l.id));
  const toggle = (id: string) => setSelected(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(l => l.id)));
  const changeSort = (key: SortKey) => setSort(s => ({ key, desc: s.key === key ? !s.desc : false }));
  const filtersActive = Boolean(debouncedQuery.trim()) || status !== 'all';

  const clearFilters = () => {
    setQuery('');
    setStatus('all');
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map(id => apiFetch(`/api/leads/${id}`, { method: 'DELETE' })));
      const count = selected.size;
      setItems(list => list.filter(l => !selected.has(l.id)));
      setSelected(new Set());
      setConfirmBulkDelete(false);
      toast.show(`${count} lead${count === 1 ? '' : 's'} deleted.`, 'danger');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = (ids?: string[]) => {
    const suffix = ids && ids.length ? `?ids=${ids.join(',')}` : '';
    toast.show(ids && ids.length ? `Exporting ${ids.length} selected leads…` : `Exporting ${rows.length} leads…`, 'info');
    // A file download has to be a real navigation, so a hidden anchor is
    // used instead of the router.
    const anchor = document.createElement('a');
    anchor.href = `/api/leads/export${suffix}`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const headers: { key: SortKey | null; label: string; className?: string }[] = [
    { key: 'name', label: 'Contact' },
    { key: 'company', label: 'Company', className: 'hidden md:table-cell' },
    { key: null, label: 'Job title', className: 'hidden xl:table-cell' },
    { key: null, label: 'Status' },
    { key: null, label: 'Tags', className: 'hidden lg:table-cell' },
    { key: null, label: 'Source', className: 'hidden xl:table-cell' },
    { key: 'lastContacted', label: 'Last contacted', className: 'hidden lg:table-cell' },
    { key: 'nextFollowUp', label: 'Next follow-up', className: 'hidden 2xl:table-cell' },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Leads & CRM"
        description={`${items.length.toLocaleString()} contact${items.length === 1 ? '' : 's'} in this workspace. Import a list, search, and manage status here.`}
        actions={
          <>
            <button onClick={() => exportCsv()} className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
              <Download className="h-4 w-4" /> Export
            </button>
            <Link href="/app/lead-lists#new" className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
              <Plus className="h-4 w-4" /> Import leads
            </Link>
          </>
        }
      />

      <div className="neu-card flex flex-col gap-3 rounded-[16px] p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => { setQuery(e.target.value); setSelected(new Set()); }} aria-label="Search leads" placeholder="Search name, company, email, or tag"
            className="w-full rounded-[10px] border border-border bg-input py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
          <select aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value as LeadStatus | 'all'); setSelected(new Set()); }}
            className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-[13px] outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/15 md:w-auto">
            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-border bg-accent/60 px-3 py-2 text-[13px]">
          <span className="font-medium text-foreground">{selected.size} selected</span>
          {confirmBulkDelete ? (
            <>
              <span className="text-muted-foreground">Delete {selected.size} lead{selected.size === 1 ? '' : 's'}? This cannot be undone.</span>
              <button onClick={() => void deleteSelected()} disabled={busy} className="ml-auto rounded-lg bg-destructive px-2.5 py-1 font-medium text-destructive-foreground disabled:opacity-50">
                {busy ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setConfirmBulkDelete(false)} className="rounded-lg border border-border bg-card px-2.5 py-1 font-medium text-foreground">Keep</button>
            </>
          ) : (
            <>
              <button onClick={() => exportCsv([...selected])} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-foreground hover:bg-card"><Download className="h-3.5 w-3.5" /> Export selected</button>
              <button onClick={() => setConfirmBulkDelete(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-destructive hover:bg-card disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              <button onClick={() => setSelected(new Set())} aria-label="Clear selection" className="ml-auto rounded-lg p-1 text-muted-foreground hover:bg-card"><X className="h-4 w-4" /></button>
            </>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="neu-card mt-4 rounded-[16px]">
          {items.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No leads yet"
              description="Import a CSV or paste a spreadsheet to create your first lead list."
              action={<Link href="/app/lead-lists#new" className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Import leads</Link>}
            />
          ) : (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="No leads match"
              description="Try a different search term or status filter."
              action={<button onClick={clearFilters} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">Clear filters</button>}
            />
          )}
        </div>
      ) : (
        <div className="neu-card mt-4 overflow-x-auto rounded-[16px]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                <th className="w-11 px-4 py-3">
                  <input type="checkbox" aria-label="Select all leads" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded accent-primary" />
                </th>
                {headers.map(h => (
                  <th key={h.label} className={cn('px-4 py-3 font-semibold', h.className)}>
                    {h.key ? (
                      <button onClick={() => changeSort(h.key!)} className="inline-flex items-center gap-1 hover:text-foreground">{h.label}<ArrowUpDown className="h-3 w-3" /></button>
                    ) : h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(l => (
                <tr key={l.id} className={cn('transition-colors hover:bg-muted/40', selected.has(l.id) && 'bg-accent/40')}>
                  <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${l.firstName} ${l.lastName}`} checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="h-4 w-4 rounded accent-primary" /></td>
                  <td className="px-4 py-3">
                    <Link href={`/app/leads/${l.id}`} className="text-left">
                      <p className="font-medium text-foreground hover:text-accent-foreground">{l.firstName} {l.lastName}</p>
                      <p className="text-[12px] text-muted-foreground">{l.email}</p>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-foreground md:table-cell">{l.company || '-'}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">{l.jobTitle || '-'}</td>
                  <td className="px-4 py-3"><LeadStatusBadge status={l.status} /></td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {l.tags.length === 0 ? <span className="text-[12px] text-muted-foreground">-</span> : l.tags.map(t => <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">{t}</span>)}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">{l.source || '-'}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{l.lastContacted ?? '-'}</td>
                  <td className="hidden px-4 py-3 text-foreground 2xl:table-cell">{l.nextFollowUp ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtersActive && rows.length > 0 && (
        <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Showing {rows.length.toLocaleString()} of {items.length.toLocaleString()} leads</span>
          <button onClick={clearFilters} className="font-medium text-accent-foreground hover:underline">Clear filters</button>
        </div>
      )}
    </div>
  );
}
