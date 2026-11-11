'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Pencil, Trash2, Archive, ArchiveRestore, Download, Copy, ChevronDown, ChevronUp, Layers, Loader2, Rows3, Info, Plus, X } from 'lucide-react';
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lists ?? []).filter((list) => !q || [list.name, list.filename ?? '', list.placeholders.join(' ')].join(' ').toLowerCase().includes(q));
  }, [lists, query]);

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
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto space-y-6">
      <PageHeader
        title="Lead lists"
        description="Uploaded lead files and their personalization variables. Each list generates its own placeholders."
        actions={
          <button onClick={() => setShowAdd((open) => !open)} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Add lead list
          </button>
        }
      />

      {showAdd && (
        <div id="new" className="neu-card rounded-[16px] p-6 scroll-mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add a lead list</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Name the list first, then upload the sheet or paste it. Leads are added only through this flow.</p>
            </div>
            <button onClick={() => setShowAdd(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-5 h-5" /></button>
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

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by list name, file, or placeholder" aria-label="Search lead lists" className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50 placeholder:text-muted-foreground" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground select-none cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
          Show archived
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {lists === null ? (
        <div className="neu-card rounded-[16px] p-10 flex items-center justify-center gap-3 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading lead lists…</div>
      ) : visible.length === 0 ? (
        <div className="neu-card rounded-[16px] p-10">
          <EmptyState
            icon={<Rows3 className="w-8 h-8" />}
            title={lists.length === 0 ? 'No lead lists yet' : 'No lead lists match'}
            description={lists.length === 0 ? 'Upload a CSV or XLSX file and give it a name. Contacts are analyzed automatically and placeholders are generated from the columns.' : 'Try another search term.'}
            action={lists.length === 0 ? <button type="button" onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground"><Plus className="w-4 h-4" /> Add lead list</button> : undefined}
          />
        </div>
      ) : (
        <ul className="grid gap-4">
          {visible.map((list) => {
            const s = list.stats;
            const isOpen = expanded === list.id;
            return (
              <li key={list.id} className="neu-card rounded-[16px] p-5">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-foreground">{list.name}</h3>
                      {list.archivedAt && <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"><Archive className="w-3 h-3" /> Archived</span>}
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">{list.source.replace('_', ' ')}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-1 truncate">{list.filename ? `From ${list.filename} · ` : ''}Added {new Date(list.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
                      <div><dt className="text-muted-foreground inline">Leads</dt> <dd className="inline font-semibold text-foreground">{list.leadCount}</dd></div>
                      <div><dt className="text-muted-foreground inline">Valid</dt> <dd className="inline font-semibold text-foreground">{s.valid_rows ?? list.leadCount}</dd></div>
                      <div><dt className="text-muted-foreground inline">Invalid</dt> <dd className="inline font-semibold text-foreground">{s.invalid_rows ?? 0}</dd></div>
                      <div><dt className="text-muted-foreground inline">Duplicates skipped</dt> <dd className="inline font-semibold text-foreground">{s.duplicate_rows ?? 0}</dd></div>
                    </dl>
                    <button type="button" onClick={() => setExpanded(isOpen ? null : list.id)} aria-expanded={isOpen} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-foreground hover:underline">
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {list.placeholders.length} variables
                    </button>
                    {isOpen && (
                      <div className="mt-3">
                        <p className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Click to copy. These variables map to this list’s columns.</p>
                        <ul className="flex flex-wrap gap-1.5">
                          {list.placeholdersDetail.map((detail) => (
                            <li key={detail.key}>
                              <button type="button" onClick={() => copy(`{{${detail.key}}}`)} title={detail.description} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[12px] font-medium text-foreground hover:bg-muted/70">
                                <code>{`{{${detail.key}}}`}</code><Copy className="w-3 h-3 text-muted-foreground" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-row lg:flex-col flex-wrap items-end gap-1.5 lg:pl-4 lg:border-l border-border">
                    <button type="button" onClick={() => { setRenameFor(list); setRenameValue(list.name); }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-muted"><Pencil className="w-3.5 h-3.5" /> Rename</button>
                    <button type="button" onClick={() => exportCsv(list)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-muted"><Download className="w-3.5 h-3.5" /> Export CSV</button>
                    <button type="button" onClick={() => void dedupe(list)} disabled={busy === list.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-muted disabled:opacity-50"><Layers className="w-3.5 h-3.5" /> Remove duplicates</button>
                    <button type="button" onClick={() => void toggleArchive(list)} disabled={busy === list.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-muted disabled:opacity-50">{list.archivedAt ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />} {list.archivedAt ? 'Restore' : 'Archive'}</button>
                    {confirmId === list.id ? (
                      <span className="ml-auto inline-flex items-center gap-2 text-[12px]">
                        <button type="button" onClick={() => void purge(list)} disabled={busy === list.id} className="px-2 py-1 rounded-lg bg-destructive text-destructive-foreground font-medium disabled:opacity-50">Delete all</button>
                        <button type="button" onClick={() => setConfirmId(null)} className="px-2 py-1 rounded-lg border border-border font-medium">Keep</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmId(list.id)} aria-label={`Delete ${list.name}`} className="p-1.5 rounded-lg text-destructive hover:bg-muted"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {renameFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRenameFor(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="rename-list-title" className="relative w-full max-w-sm neu-card rounded-[16px] p-6">
            <h2 id="rename-list-title" className="text-base font-semibold text-foreground mb-3">Rename lead list</h2>
            <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void rename(); }} className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50" aria-label="New list name" />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setRenameFor(null)} className="px-4 py-2 rounded-[10px] border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button type="button" onClick={() => void rename()} disabled={busy === renameFor.id || renameValue.trim().length < 2} className="px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">{busy === renameFor.id ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
