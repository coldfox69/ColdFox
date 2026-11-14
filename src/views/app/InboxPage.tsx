'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Inbox, MailOpen, Archive, UserCheck, Send, StickyNote, ArrowLeft, ExternalLink, Reply, MoreHorizontal } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/shared/ToastProvider';
import { type ConversationThreadVM as ConversationThread, type MessageVM as Message } from '@/lib/view-models';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useRouter } from 'next/navigation';
import { useDebouncedValue } from '@/hooks/use-debounce';

type Folder = 'all' | 'unread' | 'replied' | 'archived' | 'assigned';

const folders: { id: Folder; label: string; icon: typeof Inbox }[] = [
  { id: 'all', label: 'All conversations', icon: Inbox },
  { id: 'unread', label: 'Unread', icon: MailOpen },
  { id: 'replied', label: 'Replied', icon: Reply },
  { id: 'assigned', label: 'Assigned to me', icon: UserCheck },
  { id: 'archived', label: 'Archived', icon: Archive },
];

type Note = { id: string; threadId: string; text: string; at: string };

export default function InboxPage({ initialThreads, currentUserId }: { initialThreads: ConversationThread[]; currentUserId: string }) {
  const toast = useToast();
  const router = useRouter();
  const localIdRef = useRef(0);
  const nextLocalId = () => {
    localIdRef.current += 1;
    return `${localIdRef.current}`;
  };
  const [threads, setThreads] = useState<ConversationThread[]>(initialThreads);
  const [folder, setFolder] = useState<Folder>('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set(initialThreads.filter(t => t.assignedTo === currentUserId).map(t => t.id)));
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [notes, setNotes] = useState<Note[]>([]);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const unreadCount = threads.filter(t => t.unread && t.status !== 'archived').length;

  const visible = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return threads
      .filter(t => {
        if (folder === 'archived') return t.status === 'archived';
        if (t.status === 'archived') return false;
        if (folder === 'unread') return t.unread;
        if (folder === 'replied') return t.status === 'replied';
        if (folder === 'assigned') return assigned.has(t.id);
        return true;
      })
      .filter(t => !q || [t.leadName, t.leadEmail, t.subject, t.campaign].join(' ').toLowerCase().includes(q));
  }, [threads, folder, debouncedQuery, assigned]);

  const selected = threads.find(t => t.id === selectedId) ?? null;
  const threadNotes = notes.filter(n => n.threadId === selectedId);

  const openThread = (id: string) => {
    setSelectedId(id);
    setMenuOpen(false);
    setThreads(list => list.map(t => (t.id === id ? { ...t, unread: false } : t)));
    setReply('');
    void apiFetch(`/api/inbox/${id}/read`, { method: 'POST' }).catch(() => undefined);
  };

  const patchThread = (id: string, patch: Partial<ConversationThread>) =>
    setThreads(list => list.map(t => (t.id === id ? { ...t, ...patch } : t)));

  const send = async () => {
    if (!selected || !reply.trim() || busy) return;
    setBusy(true);
    try {
      if (mode === 'note') {
        if (!selected.leadId) throw new Error('This conversation is not linked to a lead, so there is nowhere to save the note.');
        await apiFetch(`/api/leads/${selected.leadId}`, { method: 'PATCH', body: JSON.stringify({ notes: reply.trim() }) });
        setNotes(n => [...n, { id: `n${nextLocalId()}`, threadId: selected.id, text: reply.trim(), at: 'Just now' }]);
        toast.show('Internal note saved. Leads will not see it.', 'success');
      } else {
        await apiFetch(`/api/inbox/${selected.id}/reply`, { method: 'POST', body: JSON.stringify({ body: reply.trim() }) });
        const msg: Message = {
          id: `msg${nextLocalId()}`,
          from: '',
          to: selected.leadEmail,
          subject: `Re: ${selected.subject}`,
          body: reply.trim(),
          sentAt: 'Just now',
          isOutbound: true,
        };
        patchThread(selected.id, { messages: [...selected.messages, msg], lastMessage: reply.trim(), lastMessageAt: 'Just now' });
        toast.show('Reply sent.', 'success');
        router.refresh();
      }
      setReply('');
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const toggleAssigned = async (id: string) => {
    const next = !assigned.has(id);
    setAssigned(s => {
      const copy = new Set(s);
      if (next) copy.add(id); else copy.delete(id);
      return copy;
    });
    try {
      await apiFetch(`/api/inbox/${id}`, { method: 'PATCH', body: JSON.stringify({ assigned: next }) });
      toast.show(next ? 'Assigned to you.' : 'Unassigned.', 'success');
    } catch (error) {
      setAssigned(s => {
        const copy = new Set(s);
        if (next) copy.delete(id); else copy.add(id);
        return copy;
      });
      toast.show(errorMessage(error), 'danger');
    }
  };

  const toggleArchive = async (t: ConversationThread) => {
    const archived = t.status !== 'archived';
    patchThread(t.id, { status: archived ? 'archived' : 'inbox' });
    if (archived) setSelectedId(null);
    try {
      await apiFetch(`/api/inbox/${t.id}`, { method: 'PATCH', body: JSON.stringify({ archived }) });
      toast.show(archived ? 'Conversation archived.' : 'Conversation restored.', 'success');
      router.refresh();
    } catch (error) {
      patchThread(t.id, { status: archived ? 'inbox' : 'archived' });
      toast.show(errorMessage(error), 'danger');
    }
  };

  const markAsNotSpam = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/inbox/${id}/not-spam`, { method: 'POST' });
      patchThread(id, { status: 'inbox' });
      toast.show('Moved to inbox (not spam).', 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const reportAsSpam = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/inbox/${id}/report-spam`, { method: 'POST' });
      setThreads(list => list.filter(t => t.id !== id));
      setSelectedId(null);
      toast.show('Reported as spam and removed.', 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const deleteThread = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/inbox/${id}/delete`, { method: 'DELETE' });
      setThreads(list => list.filter(t => t.id !== id));
      setSelectedId(null);
      toast.show('Conversation moved to trash.', 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const markRead = async (id: string) => {
    patchThread(id, { unread: false });
    try {
      await apiFetch(`/api/inbox/${id}/mark-read`, { method: 'POST' });
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    }
  };

  const markUnread = async (id: string) => {
    patchThread(id, { unread: true });
    try {
      await apiFetch(`/api/inbox/${id}/mark-unread`, { method: 'POST' });
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    }
  };

  const countFor = (id: Folder) => threads.filter(t => {
    if (id === 'archived') return t.status === 'archived';
    if (t.status === 'archived') return false;
    if (id === 'unread') return t.unread;
    if (id === 'replied') return t.status === 'replied';
    if (id === 'assigned') return assigned.has(t.id);
    return true;
  }).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/60 px-4 py-3 lg:px-6">
        <div>
          <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">Unified inbox</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {unreadCount} unread · {threads.length} conversation{threads.length === 1 ? '' : 's'} · every campaign reply in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/leads" className="rounded-[9px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted">View leads</Link>
          <Link href="/app/campaigns" className="rounded-[9px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted">Campaigns</Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Column 1: folders */}
        <nav aria-label="Inbox folders" className={cn('shrink-0 space-y-1 border-b border-border p-3 lg:w-52 lg:border-b-0 lg:border-r', selected && 'hidden lg:block')}>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => setFolder(f.id)}
              aria-current={folder === f.id ? 'true' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-[13px] transition-colors',
                folder === f.id ? 'bg-[var(--brand-soft)] font-medium text-[var(--brand-strong)]' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <f.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-left">{f.label}</span>
              <span className="text-[12px] tabular-nums">{countFor(f.id)}</span>
            </button>
          ))}
        </nav>

        {/* Column 2: conversation list */}
        <section className={cn('flex min-h-0 shrink-0 flex-col border-b border-border lg:w-96 lg:border-b-0 lg:border-r', selected && 'hidden lg:flex')}>
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
                className="w-full rounded-[10px] border border-border bg-input py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15"
              />
            </div>
          </div>
          <ul className="flex-1 divide-y divide-border overflow-y-auto">
            {visible.length === 0 && (
              <li className="p-6">
                <EmptyState icon={<Inbox className="h-7 w-7" />} title="Nothing here" description="No conversations match this folder or search." size="sm" />
              </li>
            )}
            {visible.map(t => (
              <li key={t.id}>
                <button
                  onClick={() => openThread(t.id)}
                  aria-current={selectedId === t.id ? 'true' : undefined}
                  className={cn('w-full p-4 text-left transition-colors hover:bg-muted/60', selectedId === t.id && 'bg-[var(--brand-soft)]')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-[13px] text-foreground', t.unread && 'font-semibold')}>{t.leadName}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{t.lastMessageAt}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-foreground/80">{t.subject}</p>
                  <p className="mt-1 truncate text-[12px] text-muted-foreground">{t.lastMessage}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {t.unread && <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
                    <span className="truncate rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{t.campaign}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Column 3: thread */}
        <section className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !selected && 'hidden lg:flex')}>
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={<Inbox className="h-7 w-7" />} title="Select a conversation" description="Replies from your campaigns appear here. Choose one on the left to read and reply." />
            </div>
          ) : (
            <>
              <header className="shrink-0 space-y-3 border-b border-border p-4">
                <button onClick={() => setSelectedId(null)} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground lg:hidden">
                  <ArrowLeft className="h-4 w-4" /> Back to list
                </button>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-foreground">{selected.leadName}</h2>
                    <p className="truncate text-[12px] text-muted-foreground">{selected.leadEmail} · {selected.campaign}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => void toggleAssigned(selected.id)} aria-pressed={assigned.has(selected.id)} className={cn('rounded-[8px] border px-3 py-1.5 text-[12px] font-medium', assigned.has(selected.id) ? 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'border-border hover:bg-muted')}>
                      {assigned.has(selected.id) ? 'Assigned to you' : 'Assign to me'}
                    </button>
                    <button onClick={() => void toggleArchive(selected)} className="rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted">
                      {selected.status === 'archived' ? 'Restore' : 'Archive'}
                    </button>
                    {selected.leadId && (
                      <Link href={`/app/leads/${selected.leadId}`} className="inline-flex items-center gap-1 rounded-[8px] border border-border px-3 py-1.5 text-[12px] font-medium hover:bg-muted">
                        Contact <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                    <div className="relative">
                      <button onClick={() => setMenuOpen(v => !v)} aria-expanded={menuOpen} aria-haspopup="menu" aria-label="More conversation actions" className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpen && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden="true" />
                          <div role="menu" className="absolute right-0 top-9 z-30 w-52 rounded-[12px] border border-border bg-popover py-1 shadow-[var(--shadow-raised-lg)]">
                            <button role="menuitem" onClick={() => { setMenuOpen(false); void markRead(selected.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted">Mark as read</button>
                            <button role="menuitem" onClick={() => { setMenuOpen(false); void markUnread(selected.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted">Mark as unread</button>
                            <button role="menuitem" onClick={() => { setMenuOpen(false); void markAsNotSpam(selected.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground hover:bg-muted">Move to inbox (not spam)</button>
                            <div className="my-1 border-t border-border" />
                            <button role="menuitem" onClick={() => { setMenuOpen(false); void reportAsSpam(selected.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--warning)] hover:bg-muted">Report spam</button>
                            <button role="menuitem" onClick={() => { setMenuOpen(false); void deleteThread(selected.id); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[var(--danger)] hover:bg-muted">Delete conversation</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {selected.messages.map(m => (
                  <div key={m.id} className={cn('max-w-[85%] whitespace-pre-wrap rounded-[14px] p-4 text-[13px] sm:max-w-[70%]', m.isOutbound ? 'ml-auto bg-[var(--brand-soft)] text-[var(--brand-strong)]' : 'border border-border bg-card text-foreground')}>
                    <p className="mb-1.5 text-[11px] opacity-70">{m.isOutbound ? 'You' : selected.leadName} · {m.sentAt}</p>
                    {m.body}
                  </div>
                ))}
                {selected.messages.length === 0 && <p className="text-center text-[13px] text-muted-foreground">No messages in this thread yet.</p>}
                {threadNotes.map(n => (
                  <div key={n.id} className="flex gap-2 rounded-[10px] border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3 text-[12px] text-[var(--warning)]">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span><strong>Internal note</strong> (not sent): {n.text}</span>
                  </div>
                ))}
              </div>

              <div className="shrink-0 space-y-3 border-t border-border p-4">
                <div role="tablist" aria-label="Reply mode" className="inline-flex gap-1 rounded-[10px] border border-border bg-muted p-1">
                  {(['reply', 'note'] as const).map(m => (
                    <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn('rounded-[7px] px-3 py-1.5 text-[12px] font-medium capitalize transition-colors', mode === m ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}>
                      {m === 'reply' ? 'Reply' : 'Internal note'}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  rows={3}
                  placeholder={mode === 'reply' ? `Reply to ${selected.leadName}…` : 'Write a note only your team can see…'}
                  aria-label={mode === 'reply' ? 'Reply' : 'Internal note'}
                  className="w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15"
                />
                <div className="flex justify-end">
                  <button onClick={() => void send()} disabled={!reply.trim() || busy} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-50">
                    <Send className="h-4 w-4" /> {busy ? 'Sending…' : mode === 'reply' ? 'Send reply' : 'Save note'}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
