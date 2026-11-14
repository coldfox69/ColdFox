'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Pencil, Trash2, Archive, ArchiveRestore, Download, Copy, ChevronDown, ChevronUp, Layers, Loader2, Rows3, Info, Plus, X, MoreHorizontal, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/shared/ToastProvider';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { LeadImportStep } from '@/components/campaign/LeadImportStep';

interface PlaceholderDetail {
  key: string;
  label: string;
  description: string;
  example: string;
}

interface LeadListSummary {
  id: string;
  name: string;
  description: string | null;
  filename: string | null;
  source: string;
  stats: { total_rows?: number; valid_rows?: number; invalid_rows?: number; duplicate_rows?: number };
  leadCount: number;
  placeholders: string[];
  placeholdersDetail: PlaceholderDetail[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

const sourceLabel: Record<string, string> = {
  csv: 'CSV file',
  xlsx: 'Excel file',
  paste: 'Pasted data',
  manual: 'Added manually',
};

export default function LeadListsPage() {
  const toast = useToast();
  const [lists, setLists] = useState<LeadListSummary[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<LeadListSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(() => typeof window !== 'undefined' && window.location.hash === '#new');
  const [addName, setAddName] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<LeadListSummary[]>(`/api/lead-lists${showArchived ? '?archived=1' : ''}`);
      setLists(data);
      setError('');
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, [showArchived]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<LeadListSummary[]>(`/api/lead-lists${showArchived ? '?archived=1' : ''}`);
        if (!cancelled) { setLists(data); setError(''); }
      } catch (cause) {
        if (!cancelled) setError(errorMessage(cause));
      }
    })();
    return () => { cancelled = true; };
  }, [showArchived]);

  // Opening #new from anywhere in the workspace (Overview, Leads) should land
  // on the form and focus it, not just scroll somewhere near it.
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash !== '#new') return;
      setShowAdd(true);
      window.requestAnimationFrame(() => document.getElementById('new')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    const frame = window.requestAnimationFrame(reveal);
    window.addEventListener('hashchange', reveal);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', reveal);
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lists ?? []).filter((list) => !q || [list.name, list.filename ?? '', list.placeholders.join(' ')].join(' ').toLowerCase().includes(q));
  }, [lists, query]);

  const activeCount = (lists ?? []).filter((list) => !list.archivedAt).length;

  const rename = async () => {
    if (!renameFor || renameValue.trim().length < 2) return;
    setBusy(renameFor.id);
    try {
      await apiFetch(`/api/lead-lists/${renameFor.id}`, { method: 'PATCH', body: JSON.stringify({ name: renameValue.trim() }) });
      toast.show('Lead list renamed.', 'success');
      setRenameFor(null);
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const toggleArchive = async (list: LeadListSummary) => {
    setBusy(list.id);
    try {
      await apiFetch(`/api/lead-lists/${list.id}`, { method: 'PATCH', body: JSON.stringify({ archived: !list.archivedAt }) });
      toast.show(list.archivedAt ? 'Lead list restored.' : 'Lead list archived.', 'success');
      setOpenMenu(null);
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const purge = async (list: LeadListSummary) => {
    setBusy(list.id);
    try {
      const result = await apiFetch<{ leadsDeleted: number }>(`/api/lead-lists/${list.id}?purge=true`, { method: 'DELETE' });
      toast.show(`Deleted "${list.name}" and ${result.leadsDeleted} leads.`, 'info');
      setConfirmId(null);
      setOpenMenu(null);
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = (list: LeadListSummary) => {
    // A file download must be a real navigation; a hidden anchor is used.
    const anchor = document.createElement('a');
    anchor.href = `/api/lead-lists/${list.id}/export`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const dedupe = async (list: LeadListSummary) => {
    setBusy(list.id);
    try {
      const result = await apiFetch<{ removed: number }>(`/api/lead-lists/${list.id}/duplicates`, { method: 'POST', body: JSON.stringify({}) });
      toast.show(result.removed ? `Removed ${result.removed} duplicate leads.` : 'No duplicates found.', 'success');
      setOpenMenu(null);
      await load();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    toast.show(`Copied ${value}`, 'info');
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Lead lists"
        description="Every list you import keeps its own columns. Use the variables from a list to personalize templates."
        actions={
          <button onClick={() => setShowAdd((open) => !open)} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
            {showAdd ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showAdd ? 'Close' : 'Add lead list'}
          </button>
        }
      />

      {showAdd && (
        <div id="new" className="neu-card scroll-mt-6 rounded-[16px] p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Add a lead list</h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                Name the list, then upload a file or paste rows. Nothing is imported until you confirm the column mapping.
              </p>
            </div>
            <button onClick={() => setShowAdd(false)} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <LeadImportStep
            nameFirst
            listName={addName}
            onListNameChange={setAddName}
            onComplete={(result) => {
              toast.show(`Created "${result.leadListName ?? addName}" with ${result.created} leads.`, 'success');
              setShowAdd(false);
              setAddName('');
              void load();
            }}
          />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by list name, file, or variable"
            aria-label="Search lead lists"
            className="w-full rounded-[10px] border border-border bg-input py-2.5 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15"
          />
        </div>
        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-muted-foreground">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
          Show archived
        </label>
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {lists === null ? (
        <div className="neu-card flex items-center justify-center gap-3 rounded-[16px] p-10 text-[13px] text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading lead lists…
        </div>
      ) : visible.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          <EmptyState
            icon={<Rows3 className="h-6 w-6" />}
            title={lists.length === 0 ? 'No lead lists yet' : 'No lead lists match'}
            description={
              lists.length === 0
                ? 'Upload a CSV or Excel file, or paste rows from a spreadsheet. ColdFox maps the columns and creates variables for you.'
                : 'Try another search term, or turn on archived lists.'
            }
            action={
              lists.length === 0 ? (
                <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground">
                  <Plus className="h-4 w-4" /> Add lead list
                </button>
              ) : (
                <button type="button" onClick={() => setQuery('')} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">
                  Clear search
                </button>
              )
            }
          />
        </div>
      ) : (
        <>
          <p className="text-[12px] text-muted-foreground">
            {visible.length} list{visible.length === 1 ? '' : 's'} shown{!showArchived && activeCount !== visible.length ? ` · ${activeCount} active` : ''}
          </p>
          <ul className="grid gap-4">
            {visible.map((list) => {
              const s = list.stats;
              const isOpen = expanded === list.id;
              const isBusy = busy === list.id;
              const duplicates = s.duplicate_rows ?? 0;
              return (
                <li key={list.id} className={cn('neu-card rounded-[16px] p-5', list.archivedAt && 'opacity-80')}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-foreground">{list.name}</h3>
                        {list.archivedAt && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Archive className="h-3 w-3" /> Archived
                          </span>
                        )}
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {sourceLabel[list.source] ?? list.source}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[12px] text-muted-foreground">
                        {list.filename ? `From ${list.filename} · ` : ''}Added {new Date(list.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
                        <div><dt className="inline text-muted-foreground">Leads</dt> <dd className="inline font-semibold text-foreground tabular-nums">{list.leadCount.toLocaleString()}</dd></div>
                        <div><dt className="inline text-muted-foreground">Valid</dt> <dd className="inline font-semibold text-foreground tabular-nums">{s.valid_rows ?? list.leadCount}</dd></div>
                        <div><dt className="inline text-muted-foreground">Invalid</dt> <dd className="inline font-semibold text-foreground tabular-nums">{s.invalid_rows ?? 0}</dd></div>
                        <div><dt className="inline text-muted-foreground">Duplicates skipped</dt> <dd className="inline font-semibold text-foreground tabular-nums">{duplicates}</dd></div>
                      </dl>
                      <button type="button" onClick={() => setExpanded(isOpen ? null : list.id)} aria-expanded={isOpen} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-foreground hover:underline">
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {list.placeholders.length} variable{list.placeholders.length === 1 ? '' : 's'}
                      </button>
                      {isOpen && (
                        <div className="mt-3 rounded-[10px] border border-border bg-muted/60 p-3">
                          <p className="mb-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Info className="h-3 w-3" /> Click a variable to copy it into a template.
                          </p>
                          {list.placeholdersDetail.length === 0 ? (
                            <p className="text-[12px] text-muted-foreground">This list has no personalization columns.</p>
                          ) : (
                            <ul className="flex flex-wrap gap-1.5">
                              {list.placeholdersDetail.map((detail) => (
                                <li key={detail.key}>
                                  <button type="button" onClick={() => copy(`{{${detail.key}}}`)} title={`${detail.label}: ${detail.description} Example: ${detail.example}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[12px] font-medium text-foreground hover:bg-muted">
                                    <code>{`{{${detail.key}}}`}</code><Copy className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2 border-t border-border pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                      <button
                        type="button"
                        onClick={() => exportCsv(list)}
                        className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
                      >
                        <Download className="h-3.5 w-3.5" /> Export CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRenameFor(list); setRenameValue(list.name); }}
                        className="inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Rename
                      </button>
                      <div className="relative ml-auto">
                        <button
                          type="button"
                          onClick={() => setOpenMenu(openMenu === list.id ? null : list.id)}
                          aria-label={`More actions for ${list.name}`}
                          aria-expanded={openMenu === list.id}
                          aria-haspopup="menu"
                          className="flex h-8 w-8 items-center justify-center rounded-[9px] border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </button>
                        {openMenu === list.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} aria-hidden="true" />
                            <div role="menu" className="absolute right-0 top-10 z-30 w-56 rounded-[12px] border border-border bg-popover py-1 shadow-[var(--shadow-raised-lg)]">
                              <button role="menuitem" onClick={() => { setOpenMenu(null); void dedupe(list); }} disabled={isBusy} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted disabled:opacity-50">
                                <Layers className="h-4 w-4" /> Remove duplicates
                              </button>
                              <button role="menuitem" onClick={() => void toggleArchive(list)} disabled={isBusy} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted disabled:opacity-50">
                                {list.archivedAt ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {list.archivedAt ? 'Restore list' : 'Archive list'}
                              </button>
                              <div className="my-1 border-t border-border" />
                              <button role="menuitem" onClick={() => { setOpenMenu(null); setConfirmId(list.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-destructive hover:bg-muted">
                                <Trash2 className="h-4 w-4" /> Delete list and leads
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {confirmId === list.id && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                      <p className="min-w-0 flex-1 text-[12px] text-foreground">
                        Delete <strong>{list.name}</strong> and all {list.leadCount.toLocaleString()} lead{list.leadCount === 1 ? '' : 's'}? This cannot be undone.
                      </p>
                      <button type="button" onClick={() => void purge(list)} disabled={isBusy} className="rounded-lg bg-destructive px-3 py-1.5 text-[12px] font-medium text-destructive-foreground disabled:opacity-50">
                        {isBusy ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted">Keep</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {renameFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0b1220]/50 backdrop-blur-[2px]" onClick={() => setRenameFor(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="rename-list-title" className="relative w-full max-w-sm rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-raised-lg)]">
            <h2 id="rename-list-title" className="mb-1 text-[15px] font-semibold text-foreground">Rename lead list</h2>
            <p className="mb-3 text-[12px] text-muted-foreground">The leads themselves are not changed.</p>
            <label htmlFor="rename-list-input" className="sr-only">New list name</label>
            <input
              id="rename-list-input"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void rename(); if (e.key === 'Escape') setRenameFor(null); }}
              className="w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/15"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRenameFor(null)} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">Cancel</button>
              <button type="button" onClick={() => void rename()} disabled={busy === renameFor.id || renameValue.trim().length < 2} className="rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50">
                {busy === renameFor.id ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
