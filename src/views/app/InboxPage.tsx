'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Inbox, MailOpen, Archive, UserCheck, Send, StickyNote, ArrowLeft, ExternalLink, Reply } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/shared/ToastProvider';
import { type ConversationThreadVM as ConversationThread, type MessageVM as Message } from '@/lib/view-models';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useRouter } from 'next/navigation';

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
  const [threads, setThreads] = useState<ConversationThread[]>(initialThreads);
  const [folder, setFolder] = useState<Folder>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set(initialThreads.filter(t => t.assignedTo === currentUserId).map(t => t.id)));
  const [reply, setReply] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [notes, setNotes] = useState<Note[]>([]);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [threads, folder, query, assigned]);

  const selected = threads.find(t => t.id === selectedId) ?? null;
  const threadNotes = notes.filter(n => n.threadId === selectedId);

  const openThread = (id: string) => {
    setSelectedId(id);
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
        setNotes(n => [...n, { id: `n${Date.now()}`, threadId: selected.id, text: reply.trim(), at: 'Just now' }]);
        toast.show('Internal note saved. Leads will not see it.', 'success');
      } else {
        await apiFetch(`/api/inbox/${selected.id}/reply`, { method: 'POST', body: JSON.stringify({ body: reply.trim() }) });
        const msg: Message = {
          id: `msg${Date.now()}`,
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

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0">
      {/* Column 1: folders */}
      <nav aria-label="Inbox folders" className={cn('lg:w-52 shrink-0 border-b lg:border-b-0 lg:border-r border-border p-3 space-y-1', selected && 'hidden lg:block')}>
        {folders.map(f => {
          const count = threads.filter(t => {
            if (f.id === 'archived') return t.status === 'archived';
            if (t.status === 'archived') return false;
            if (f.id === 'unread') return t.unread;
            if (f.id === 'replied') return t.status === 'replied';
            if (f.id === 'assigned') return assigned.has(t.id);
            return true;
          }).length;
          return (
            <button
              key={f.id}
              onClick={() => setFolder(f.id)}
              aria-current={folder === f.id ? 'true' : undefined}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors',
                folder === f.id ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <f.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">{f.label}</span>
              <span className="text-[12px] tabular-nums">{count}</span>
            </button>
          );
        })}
      </nav>

      {/* Column 2: conversation list */}
      <section className={cn('lg:w-96 shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col min-h-0', selected && 'hidden lg:flex')}>
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-border">
          {visible.length === 0 && (
            <li className="p-6">
              <EmptyState icon={<Inbox className="w-8 h-8" />} title="Nothing here" description="No conversations match this folder or search." size="sm" />
            </li>
          )}
          {visible.map(t => (
            <li key={t.id}>
              <button
                onClick={() => openThread(t.id)}
                aria-current={selectedId === t.id ? 'true' : undefined}
                className={cn('w-full text-left p-4 hover:bg-muted/60 transition-colors', selectedId === t.id && 'bg-accent/60')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-sm truncate', t.unread ? 'font-semibold text-foreground' : 'text-foreground')}>{t.leadName}</span>
                  <span className="text-[12px] text-muted-foreground shrink-0">{t.lastMessageAt}</span>
                </div>
                <p className="text-[12px] text-foreground/80 truncate mt-0.5">{t.subject}</p>
                <p className="text-[12px] text-muted-foreground truncate mt-1">{t.lastMessage}</p>
                <div className="flex items-center gap-2 mt-2">
                  {t.unread && <span className="w-2 h-2 rounded-full bg-primary" aria-label="Unread" />}
                  <span className="text-[12px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground truncate">{t.campaign}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Column 3: thread */}
      <section className={cn('flex-1 min-w-0 flex flex-col min-h-0', !selected && 'hidden lg:flex')}>
        {!selected ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState icon={<Inbox className="w-8 h-8" />} title="Select a conversation" description="Replies from your campaigns appear here." />
          </div>
        ) : (
          <>
            <header className="p-4 border-b border-border space-y-3">
              <button onClick={() => setSelectedId(null)} className="lg:hidden inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <ArrowLeft className="w-4 h-4" /> Back to list
              </button>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground truncate">{selected.leadName}</h2>
                  <p className="text-[12px] text-muted-foreground truncate">{selected.leadEmail} · {selected.campaign}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => void toggleAssigned(selected.id)} aria-pressed={assigned.has(selected.id)} className={cn('px-3 py-1.5 rounded-lg border text-[12px] font-medium', assigned.has(selected.id) ? 'border-primary bg-accent' : 'border-border hover:bg-muted')}>
                    {assigned.has(selected.id) ? 'Assigned to you' : 'Assign to me'}
                  </button>
                  <button onClick={() => void toggleArchive(selected)} className="px-3 py-1.5 rounded-lg border border-border text-[12px] font-medium hover:bg-muted">
                    {selected.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                  {selected.leadId && (
                    <Link href={`/app/leads/${selected.leadId}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-[12px] font-medium hover:bg-muted">
                      Contact profile <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selected.messages.map(m => (
                <div key={m.id} className={cn('max-w-[85%] sm:max-w-[70%] rounded-[16px] p-4 text-sm whitespace-pre-wrap', m.isOutbound ? 'ml-auto bg-accent text-accent-foreground' : 'bg-muted text-foreground')}>
                  <p className="text-[12px] opacity-70 mb-1.5">{m.isOutbound ? 'You' : selected.leadName} · {m.sentAt}</p>
                  {m.body}
                </div>
              ))}
              {threadNotes.map(n => (
                <div key={n.id} className="flex gap-2 text-[12px] text-[var(--cf-warning)] neu-inset-sm rounded-[10px] p-3">
                  <StickyNote className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span><strong>Internal note</strong> (not sent): {n.text}</span>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <div role="tablist" className="inline-flex gap-1 rounded-[10px] bg-input p-1 shadow-[var(--shadow-inset-sm)]">
                {(['reply', 'note'] as const).map(m => (
                  <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn('rounded-[8px] px-3 py-1.5 text-[12px] font-medium capitalize transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)]', mode === m ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}>
                    {m === 'reply' ? 'Reply' : 'Internal note'}
                  </button>
                ))}
              </div>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                rows={3}
                placeholder={mode === 'reply' ? `Reply to ${selected.leadName}...` : 'Write a note only your team can see...'}
                aria-label={mode === 'reply' ? 'Reply' : 'Internal note'}
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex justify-end">
                <button onClick={() => void send()} disabled={!reply.trim() || busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">
                  <Send className="w-4 h-4" /> {busy ? 'Sending…' : mode === 'reply' ? 'Send reply' : 'Save note'}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
