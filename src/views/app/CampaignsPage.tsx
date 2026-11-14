'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronLeft, ChevronRight, ArrowUpDown, Megaphone, MoreHorizontal, Pause, Play, Copy, Trash2, Eye, Rocket, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { CampaignStatusBadge } from '@/components/shared/StatusBadge';
import { type CampaignStatus, type CampaignVM as Campaign } from '@/lib/view-models';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/shared/ToastProvider';
import { useRouter } from 'next/navigation';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useDebouncedValue } from '@/hooks/use-debounce';

const PAGE_SIZE = 10;
const filters: { value: CampaignStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'draft', label: 'Drafts' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

type SortKey = 'name' | 'emailsSent' | 'replyRate' | 'createdAt';

type WorkerStatus = { lastRunAt: string | null; ageSeconds: number | null; stale: boolean };

type MenuAnchor = { id: string; top: number; left: number };

function workerAge(seconds: number | null) {
  if (seconds === null) return 'never';
  if (seconds < 90) return `${seconds}s ago`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min ago`;
  return `${Math.round(seconds / 3600)} h ago`;
}

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
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);

  const hasLiveCampaigns = useMemo(
    () => items.some(c => c.status === 'scheduled' || c.status === 'active'),
    [items],
  );

  useEffect(() => {
    if (!hasLiveCampaigns) return;
    let cancelled = false;
    const load = () => {
      apiFetch<WorkerStatus>('/api/cron/status')
        .then(next => { if (!cancelled) setWorker(next); })
        .catch(() => { if (!cancelled) setWorker(null); });
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [hasLiveCampaigns]);

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
  const filtersActive = Boolean(debouncedQuery.trim()) || status !== 'all';

  const changeSort = (key: SortKey) => {
    if (key === sortKey) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setPage(1);
  };

  /** The menu is positioned in viewport coordinates so the table's scroll
   *  container cannot clip it. */
  const openMenu = (id: string, button: HTMLElement) => {
    if (menu?.id === id) { setMenu(null); return; }
    const rect = button.getBoundingClientRect();
    setMenu({
      id,
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - 208),
    });
    setConfirmId(null);
  };

  const pause = async (c: Campaign) => {
    setBusy(c.id);
    try {
      await apiFetch(`/api/campaigns/${c.id}/pause`, { method: 'POST' });
      setItems(list => list.map(x => (x.id === c.id ? { ...x, status: 'paused' } : x)));
      toast.show(`"${c.name}" paused.`, 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
      setMenu(null);
    }
  };

  const resume = async (c: Campaign) => {
    setBusy(c.id);
    try {
      await apiFetch(`/api/campaigns/${c.id}/resume`, { method: 'POST' });
      setItems(list => list.map(x => (x.id === c.id ? { ...x, status: 'active' } : x)));
      toast.show(`"${c.name}" resumed.`, 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
      setMenu(null);
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
      setMenu(null);
    }
  };

  const remove = async (c: Campaign) => {
    setBusy(c.id);
    try {
      await apiFetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
      setItems(list => list.filter(x => x.id !== c.id));
      setConfirmId(null);
      toast.show(`"${c.name}" was cancelled.`, 'danger');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
      setMenu(null);
    }
  };

  const menuCampaign = menu ? items.find(c => c.id === menu.id) : null;

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Campaigns"
        description="Each campaign sends one template to one lead list from one mailbox. You can pause or stop at any time."
        actions={
          <Link href="/app/campaigns/new" className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
            <Plus className="h-4 w-4" /> Create campaign
          </Link>
        }
      />

      <div className="neu-card flex flex-col gap-3 rounded-[16px] p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search campaigns by name"
            aria-label="Search campaigns"
            className="w-full rounded-[10px] border border-border bg-input py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15"
          />
        </div>
        <div className="inline-flex gap-1 overflow-x-auto rounded-[10px] border border-border bg-muted p-1" role="tablist" aria-label="Filter by status">
          {filters.map(f => (
            <button
              key={f.value}
              role="tab"
              aria-selected={status === f.value}
              onClick={() => { setStatus(f.value); setPage(1); }}
              className={cn('whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors', status === f.value ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {hasLiveCampaigns && worker?.stale && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border border-[var(--cf-warning)]/35 bg-[var(--cf-warning)]/[0.07] px-3 py-2 text-[12px]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--cf-warning)]" />
          <span className="text-[var(--cf-warning)]">
            The background sender is not running. Scheduled campaigns will not start on their own
            {worker.lastRunAt ? ` (last run ${workerAge(worker.ageSeconds)}).` : '.'}
          </span>
        </div>
      )}
      {hasLiveCampaigns && worker && !worker.stale && (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Background sender is active, last run {workerAge(worker.ageSeconds)}. Scheduled campaigns keep sending with this browser closed.
        </p>
      )}

      {visible.length === 0 ? (
        <div className="neu-card mt-4 rounded-[16px]">
          {items.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-6 w-6" />}
              title="No campaigns yet"
              description="A campaign is one template sent to one lead list. Create your first one when you have a lead list and a mailbox."
              action={<Link href="/app/campaigns/new" className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Create campaign</Link>}
            />
          ) : (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="No campaigns match"
              description="Try a different search term or status filter."
              action={filtersActive ? <button onClick={clearFilters} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">Clear filters</button> : undefined}
            />
          )}
        </div>
      ) : (
        <div className="neu-card mt-4 overflow-hidden rounded-[16px]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                {([['name', 'Campaign', ''], ['emailsSent', 'Sent', 'hidden sm:table-cell'], ['replyRate', 'Reply rate', 'hidden md:table-cell'], ['createdAt', 'Created', 'hidden lg:table-cell']] as [SortKey, string, string][]).map(([key, labelText, cls]) => (
                  <th key={key} className={cn('px-4 py-3 font-semibold', cls)}>
                    <button onClick={() => changeSort(key)} className="inline-flex items-center gap-1 hover:text-foreground">
                      {labelText} <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map(c => (
                <tr key={c.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/app/campaigns/${c.id}`} className="font-medium text-foreground hover:text-accent-foreground hover:underline">{c.name}</Link>
                    <p className="line-clamp-1 max-w-xs text-[12px] text-muted-foreground">{c.description || 'No description'}</p>
                  </td>
                  <td className="hidden px-4 py-3 tabular-nums text-foreground sm:table-cell">{c.emailsSent.toLocaleString()}</td>
                  <td className="hidden px-4 py-3 tabular-nums text-foreground md:table-cell">{c.emailsSent ? `${c.replyRate}%` : '-'}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{c.createdAt}</td>
                  <td className="px-4 py-3"><CampaignStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      aria-label={`Actions for ${c.name}`}
                      disabled={busy === c.id}
                      onClick={e => openMenu(c.id, e.currentTarget)}
                      aria-expanded={menu?.id === c.id}
                      aria-haspopup="menu"
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Showing {visible.length} of {filtered.length} campaigns</span>
          <div className="flex items-center gap-2">
            <button disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Previous page" className="rounded-lg border border-border p-1.5 hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span>Page {current} of {pageCount}</span>
            <button disabled={current >= pageCount} onClick={() => setPage(current + 1)} aria-label="Next page" className="rounded-lg border border-border p-1.5 hover:bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {menu && menuCampaign && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setMenu(null); setConfirmId(null); }} aria-hidden="true" />
          <div
            role="menu"
            className="fixed z-50 w-52 rounded-[12px] border border-border bg-popover py-1 text-left shadow-[var(--shadow-raised-lg)]"
            style={{ top: menu.top, left: menu.left }}
          >
            {confirmId === menuCampaign.id ? (
              <div className="px-3 py-2">
                <p className="text-[12px] leading-relaxed text-foreground">Cancel this campaign? Sending stops immediately.</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => void remove(menuCampaign)} disabled={busy === menuCampaign.id} className="rounded-md bg-destructive px-2.5 py-1 text-[12px] font-medium text-destructive-foreground disabled:opacity-50">
                    {busy === menuCampaign.id ? 'Cancelling…' : 'Cancel campaign'}
                  </button>
                  <button onClick={() => setConfirmId(null)} className="rounded-md border border-border px-2.5 py-1 text-[12px] font-medium">Keep</button>
                </div>
              </div>
            ) : (
              <>
                <MenuItem icon={Eye} label="View details" onClick={() => { setMenu(null); router.push(`/app/campaigns/${menuCampaign.id}`); }} />
                {menuCampaign.status === 'draft' && (
                  <MenuItem icon={Rocket} label="Review and launch" onClick={() => { setMenu(null); router.push(`/app/campaigns/${menuCampaign.id}`); }} />
                )}
                {menuCampaign.status === 'active' && <MenuItem icon={Pause} label="Pause sending" onClick={() => void pause(menuCampaign)} />}
                {menuCampaign.status === 'paused' && <MenuItem icon={Play} label="Resume sending" onClick={() => void resume(menuCampaign)} />}
                <MenuItem icon={Copy} label="Duplicate as draft" onClick={() => void duplicate(menuCampaign)} />
                <div className="my-1 border-t border-border" />
                <MenuItem icon={Trash2} label="Cancel campaign" danger onClick={() => setConfirmId(menuCampaign.id)} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={cn('flex w-full items-center gap-2 px-3 py-2 text-[13px] hover:bg-muted', danger ? 'text-destructive' : 'text-foreground')}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
