'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronLeft, ChevronRight, ArrowUpDown, Megaphone, MoreHorizontal, Pause, Play, Copy, Trash2, Eye } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { CampaignStatusBadge } from '@/components/shared/StatusBadge';
import { type CampaignStatus, type CampaignVM as Campaign } from '@/lib/view-models';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useDebouncedValue } from '@/hooks/use-debounce';


const PAGE_SIZE = 5;
const filters: { value: CampaignStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Drafts' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

type SortKey = 'name' | 'emailsSent' | 'replyRate' | 'createdAt';

export default function CampaignsPage({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Campaign[]>(initialCampaigns);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<CampaignStatus | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const list = items.filter(c =>
      (status === 'all' || c.status === status) &&
      (!q || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    );
    return [...list].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDesc ? -cmp : cmp;
    });
  }, [items, debouncedQuery, status, sortKey, sortDesc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const changeSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const updateStatus = async (id: string, next: CampaignStatus, message: string) => {
    const action = next === 'paused' ? 'pause' : 'resume';
    setBusy(id);
    try {
      await apiFetch(`/api/campaigns/${id}/${action}`, { method: 'POST' });
      setItems(list => list.map(c => (c.id === id ? { ...c, status: next } : c)));
      toast.show(message);
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
      setOpenMenu(null);
    }
  };

  const duplicate = async (c: Campaign) => {
    setBusy(c.id);
    try {
      await apiFetch(`/api/campaigns/${c.id}/duplicate`, { method: 'POST', body: JSON.stringify({}) });
      toast.show(`Duplicated "${c.name}". The copy is saved as a draft.`, 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
      setOpenMenu(null);
    }
  };

  const remove = async (c: Campaign) => {
    setBusy(c.id);
    try {
      await apiFetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
      setItems(list => list.filter(x => x.id !== c.id));
      toast.show(`"${c.name}" was cancelled.`, 'danger');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
      setOpenMenu(null);
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto">
      <PageHeader
        title="Campaigns"
        description="Create, schedule, and monitor your outreach campaigns."
        actions={<Link href="/app/campaigns/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50"><Plus className="w-4 h-4" /> Create campaign</Link>}
      />

      <div className="neu-card rounded-[16px] p-3 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search campaigns"
            aria-label="Search campaigns"
            className="w-full pl-9 pr-3 py-2 rounded-[10px] bg-input py-2 pl-9 pr-3 text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] focus:border-ring focus:ring-[3px] focus:ring-ring/50"
          />
        </div>
        <div className="inline-flex gap-1 overflow-x-auto rounded-[10px] bg-input p-1 shadow-[var(--shadow-inset-sm)]" role="tablist" aria-label="Filter by status">
          {filters.map(f => (
            <button
              key={f.value}
              role="tab"
              aria-selected={status === f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
              className={cn('rounded-[8px] px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)]', status === f.value ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="neu-card rounded-[16px] mt-4">
          <EmptyState icon={<Megaphone className="w-6 h-6" />} title="No campaigns match" description="Try a different search or status filter." />
        </div>
      ) : (
        <div className="neu-card rounded-[16px] mt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground border-b border-border">
                {([['name', 'Campaign'], ['emailsSent', 'Sent'], ['replyRate', 'Reply rate'], ['createdAt', 'Created']] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="px-4 py-3 font-medium">
                    <button onClick={() => changeSort(key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {label} <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(c => (
                <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/app/campaigns/${c.id}`} className="font-medium text-foreground hover:underline">{c.name}</Link>
                    <p className="text-[12px] text-muted-foreground line-clamp-1 max-w-xs">{c.description}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground">{c.emailsSent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-foreground">{c.emailsSent ? `${c.replyRate}%` : '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.createdAt}</td>
                  <td className="px-4 py-3"><CampaignStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-right relative">
                    <button aria-label={`Actions for ${c.name}`} disabled={busy === c.id} onClick={() => setOpenMenu(openMenu === c.id ? null : c.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-40">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === c.id && (
                      <div className="absolute right-4 top-11 z-20 w-44 neu-card rounded-xl py-1 text-left shadow-lg">
                        {c.status === 'active' && <MenuItem icon={Pause} label="Pause" onClick={() => void updateStatus(c.id, 'paused', `"${c.name}" paused.`)} />}
                        {(c.status === 'paused' || c.status === 'draft') && <MenuItem icon={Play} label="Resume" onClick={() => void updateStatus(c.id, 'active', `"${c.name}" resumed.`)} />}
                        <MenuItem icon={Eye} label="View" onClick={() => router.push(`/app/campaigns/${c.id}`)} />
                        <MenuItem icon={Copy} label="Duplicate" onClick={() => void duplicate(c)} />
                        <MenuItem icon={Trash2} label="Cancel" danger onClick={() => void remove(c)} />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>Showing {visible.length} of {filtered.length} campaigns</span>
        <div className="flex items-center gap-2">
          <button disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page" className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          <span>Page {current} of {pageCount}</span>
          <button disabled={current >= pageCount} onClick={() => setPage(current + 1)} aria-label="Next page" className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted', danger ? 'text-destructive' : 'text-foreground')}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
