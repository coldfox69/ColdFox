'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Download, Upload, Trash2, X, Tag, ArrowUpDown } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LeadStatusBadge } from '@/components/shared/StatusBadge';
import { type LeadStatus, type LeadVM as Lead } from '@/lib/view-models';
import { useToast } from '@/components/shared/ToastProvider';
import { cn } from '@/lib/utils';
import { LeadFormModal } from '@/components/leads/LeadFormModal';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { fromLeadStatus } from '@/lib/view-models';

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

export default function LeadsPage({ initialLeads, canImport = true }: { initialLeads: Lead[]; canImport?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Lead[]>(initialLeads);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<LeadStatus | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'name', desc: false });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Lead | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [items, query, status, sort]);

  const allSelected = rows.length > 0 && rows.every(l => selected.has(l.id));
  const toggle = (id: string) => setSelected(s => {
    const next = new Set(s);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map(l => l.id)));

  const changeSort = (key: SortKey) => setSort(s => ({ key, desc: s.key === key ? !s.desc : false }));

  const deleteSelected = async () => {
    if (!selected.size) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map(id => apiFetch(`/api/leads/${id}`, { method: 'DELETE' })));
      const count = selected.size;
      setItems(list => list.filter(l => !selected.has(l.id)));
      setSelected(new Set());
      toast.show(`${count} lead${count === 1 ? '' : 's'} deleted.`, 'danger');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const saveLead = async (lead: Lead) => {
    setBusy(true);
    try {
      const payload = {
        first_name: lead.firstName || null,
        last_name: lead.lastName || null,
        email: lead.email,
        company_name: lead.company || null,
        job_title: lead.jobTitle || null,
        status: fromLeadStatus(lead.status),
        tags: lead.tags,
        source: lead.source || 'manual',
        next_follow_up_at: lead.nextFollowUp ? new Date(`${lead.nextFollowUp}T09:00:00Z`).toISOString() : null,
        notes: lead.notes || null,
      };
      if (editing === 'new') {
        const created = await apiFetch<Lead>('/api/leads', { method: 'POST', body: JSON.stringify(payload) });
        setItems(list => [created, ...list]);
        toast.show(`${lead.firstName} ${lead.lastName} saved.`);
      } else {
        const updated = await apiFetch<Lead>(`/api/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setItems(list => list.map(l => (l.id === lead.id ? updated : l)));
        toast.show(`${lead.firstName} ${lead.lastName} saved.`);
      }
      setEditing(null);
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const deleteLead = async () => {
    if (!editing || editing === 'new') return;
    setBusy(true);
    try {
      await apiFetch(`/api/leads/${editing.id}`, { method: 'DELETE' });
      setItems(list => list.filter(l => l.id !== editing.id));
      setEditing(null);
      toast.show('Lead deleted.', 'danger');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    toast.show(`Exporting ${rows.length} leads…`, 'info');
    window.location.href = '/api/leads/export';
  };

  const headers: { key: SortKey | null; label: string }[] = [
    { key: 'name', label: 'Contact' },
    { key: 'company', label: 'Company' },
    { key: null, label: 'Job title' },
    { key: null, label: 'Status' },
    { key: null, label: 'Tags' },
    { key: null, label: 'Source' },
    { key: 'lastContacted', label: 'Last contacted' },
    { key: 'nextFollowUp', label: 'Next follow-up' },
  ];

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto">
      <PageHeader
        title="Leads & CRM"
        description={`${items.length.toLocaleString()} leads in your workspace`}
        actions={
          <>
            <button onClick={() => window.location.assign('/app/leads/import')} disabled={!canImport} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50"><Upload className="w-4 h-4" /> Import</button>
            <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50"><Download className="w-4 h-4" /> Export</button>
            <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50"><Plus className="w-4 h-4" /> Add lead</button>
          </>
        }
      />

      <div className="neu-card rounded-[16px] p-3 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} aria-label="Search leads" placeholder="Search name, company, email, or tag"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-input py-2 pl-9 pr-3 text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] focus:border-ring focus:ring-[3px] focus:ring-ring/50" />
        </div>
        <select aria-label="Filter by status" value={status} onChange={e => setStatus(e.target.value as LeadStatus | 'all')}
          className="px-3 py-2 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60">
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[16px] neu-inset-sm px-4 py-2.5 text-sm">
          <span className="font-medium text-foreground">{selected.size} selected</span>
          <button onClick={() => toast.show('Select leads and use Add tag from the bulk actions to tag them.', 'info')} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-card text-foreground"><Tag className="w-3.5 h-3.5" /> Add tag</button>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-card text-foreground"><Download className="w-3.5 h-3.5" /> Export</button>
          <button onClick={() => void deleteSelected()} disabled={busy} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-card text-destructive disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          <button onClick={() => setSelected(new Set())} aria-label="Clear selection" className="ml-auto p-1 rounded-lg hover:bg-card text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="neu-card rounded-[16px] mt-4">
          <EmptyState icon={<Search className="w-6 h-6" />} title="No leads match these filters" description="Clear the search or choose another status to see more leads." />
        </div>
      ) : (
        <div className="neu-card rounded-[16px] mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground border-b border-border">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" aria-label="Select all leads" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-blue-600" />
                </th>
                {headers.map(h => (
                  <th key={h.label} className="px-4 py-3 font-medium">
                    {h.key ? (
                      <button onClick={() => changeSort(h.key!)} className="inline-flex items-center gap-1 hover:text-foreground">{h.label}<ArrowUpDown className="w-3 h-3" /></button>
                    ) : h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(l => (
                <tr key={l.id} className={cn('hover:bg-muted/40 transition-colors', selected.has(l.id) && 'bg-accent')}>
                  <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${l.firstName} ${l.lastName}`} checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="h-4 w-4 accent-blue-600" /></td>
                  <td className="px-4 py-3">
                    <Link href={`/app/leads/${l.id}`} className="text-left">
                      <p className="font-medium text-foreground hover:text-accent-foreground">{l.firstName} {l.lastName}</p>
                      <p className="text-[12px] text-muted-foreground">{l.email}</p>
                    </Link>
                    <button onClick={() => setEditing(l)} className="mt-1 text-[12px] font-medium text-primary hover:underline">Edit details</button>
                  </td>
                  <td className="px-4 py-3 text-foreground">{l.company}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.jobTitle}</td>
                  <td className="px-4 py-3"><LeadStatusBadge status={l.status} /></td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{l.tags.map(t => <span key={t} className="px-2 py-0.5 rounded-md bg-muted text-[12px] text-muted-foreground">{t}</span>)}</div></td>
                  <td className="px-4 py-3 text-muted-foreground">{l.source}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.lastContacted ?? '-'}</td>
                  <td className="px-4 py-3 text-foreground">{l.nextFollowUp ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <LeadFormModal
          lead={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(lead) => void saveLead(lead)}
          onDelete={editing !== 'new' ? () => void deleteLead() : undefined}
        />
      )}
    </div>
  );
}
