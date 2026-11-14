'use client';

import { useRef, useState } from 'react';
import { MessageSquare, Plus, Search, Send, LifeBuoy, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useRouter } from 'next/navigation';

export interface SupportData {
  tickets: Array<{
    id: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    createdAt: string;
    updatedAt: string;
    messages: Array<{ id: string; body: string; authorType: string; createdAt: string }>;
  }>;
  categories: Array<{ key: string; name: string }>;
  articles: Array<{ slug: string; title: string; body: string; category: string }>;
}

const statusVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  open: 'danger',
  in_progress: 'info',
  waiting: 'warning',
  resolved: 'success',
  closed: 'muted',
};

const statusLabel: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting: 'Waiting on you',
  resolved: 'Resolved',
  closed: 'Closed',
};

const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15';

export default function SupportPage({ data }: { data: SupportData }) {
  const toast = useToast();
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [creating, setCreating] = useState(false);

  const articles = data.articles.filter(
    a => !debouncedQuery || [a.title, a.body, a.category].join(' ').toLowerCase().includes(debouncedQuery.toLowerCase()),
  );

  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return toast.show('Subject and description are required.', 'danger');
    setCreating(true);
    try {
      await apiFetch('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: newSubject.trim(),
          description: newDescription.trim(),
          category_key: newCategory || undefined,
          priority: 'normal',
        }),
      });
      toast.show('Ticket created. We will reply by email.', 'success');
      setNewSubject('');
      setNewDescription('');
      setNewCategory('');
      router.refresh();
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setCreating(false);
    }
  };

  const focusForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus(), 350);
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Support"
        description="Short answers first, then a direct line to the team if you still need help."
        actions={
          <button onClick={focusForm} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
            <Plus className="h-4 w-4" /> New ticket
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <section className="neu-card rounded-[16px] p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">Knowledge base</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{data.articles.length} short guide{data.articles.length === 1 ? '' : 's'}</p>
              </div>
              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search articles" aria-label="Search knowledge base" className={cn(inputCls, 'pl-9 py-2')} />
              </div>
            </div>
            {data.articles.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">No help articles published yet. Open a ticket and we will help directly.</p>
            ) : articles.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">No articles match “{query}”. Try a shorter search.</p>
            ) : (
              <div className="space-y-2.5">
                {articles.map(a => (
                  <details key={a.slug} className="group rounded-[10px] border border-border bg-card px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-[13px] font-medium text-foreground">{a.title}</span>
                        <span className="mt-0.5 block text-[12px] text-muted-foreground">{a.category}</span>
                      </span>
                      <span className="shrink-0 text-[12px] font-medium text-accent-foreground group-open:hidden">Read</span>
                      <span className="hidden shrink-0 text-[12px] font-medium text-muted-foreground group-open:inline">Close</span>
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-[13px] leading-relaxed text-foreground/85">{a.body}</p>
                  </details>
                ))}
              </div>
            )}
          </section>

          <section className="neu-card rounded-[16px]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">Your tickets</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Track what you have sent us</p>
              </div>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </div>
            {data.tickets.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<LifeBuoy className="h-5 w-5" />}
                title="No tickets yet"
                description="If a guide does not solve it, open a ticket and the team will reply by email."
                action={<button onClick={focusForm} className="rounded-[9px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted">Open a ticket</button>}
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.tickets.map(t => (
                  <li key={t.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-foreground">{t.subject}</p>
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{t.description}</p>
                      </div>
                      <StatusBadge variant={statusVariant[t.status] ?? 'muted'} size="sm">{statusLabel[t.status] ?? t.status}</StatusBadge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Updated {t.updatedAt.slice(0, 10)}</span>
                      {t.category && <span>{t.category}</span>}
                      {t.messages.length > 0 && <span>{t.messages.length} repl{t.messages.length === 1 ? 'y' : 'ies'}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div ref={formRef} className="lg:col-span-2">
          <form onSubmit={createTicket} className="neu-card rounded-[16px] p-5 lg:sticky lg:top-4">
            <div className="mb-4">
              <h2 className="text-[15px] font-semibold text-foreground">Open a ticket</h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">Tell us what happened and what you expected. Screenshots can be added in the reply email.</p>
            </div>
            <div className="space-y-3.5">
              <div>
                <label htmlFor="ticket-subject" className="mb-1.5 block text-[13px] font-medium text-foreground">Subject</label>
                <input id="ticket-subject" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="A short summary" className={inputCls} required />
              </div>
              <div>
                <label htmlFor="ticket-category" className="mb-1.5 block text-[13px] font-medium text-foreground">Category <span className="font-normal text-muted-foreground">(optional)</span></label>
                <select id="ticket-category" value={newCategory} onChange={e => setNewCategory(e.target.value)} className={inputCls}>
                  <option value="">Choose a category</option>
                  {data.categories.map(c => <option key={c.key} value={c.key}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ticket-description" className="mb-1.5 block text-[13px] font-medium text-foreground">What can we help with?</label>
                <textarea id="ticket-description" value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={6} placeholder="Describe the issue and what you were trying to do." className={cn(inputCls, 'resize-y')} required />
              </div>
              <button type="submit" disabled={creating} className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-60">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {creating ? 'Sending…' : 'Submit ticket'}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">We usually reply within one business day.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
