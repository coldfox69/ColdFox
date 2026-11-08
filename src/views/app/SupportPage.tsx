'use client';

import { useState } from 'react';
import { Ticket, MessageSquare, Plus, Scroll, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';

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

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  open: 'danger',
  in_progress: 'info',
  waiting: 'warning',
  resolved: 'success',
  closed: 'muted',
};

export default function SupportPage({ data }: { data: SupportData }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const filtered = data.tickets.filter(
    (t) =>
      !query ||
      t.subject.toLowerCase().includes(query.toLowerCase()) ||
      t.description.toLowerCase().includes(query.toLowerCase()),
  );

  const createTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) return toast.show('Subject and description are required.', 'danger');
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
      toast.show('Support ticket created.', 'success');
      setNewSubject('');
      setNewDescription('');
      setNewCategory('');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/support/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.show(`Ticket set to ${status}.`, 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Support"
        description="Help articles and support tickets for your workspace."
        actions={
          <button
            onClick={() => toast.show('Ticket creation comes in the next release.', 'info')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-blue text-white text-sm font-semibold hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> New ticket
          </button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 neu-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Knowledge base</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles…"
              aria-label="Search knowledge base"
              className="w-64 pl-3 py-1.5 rounded-xl bg-muted text-sm border border-transparent focus:outline-none focus:border-ring focus:bg-card"
            />
          </div>
          {data.articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No help articles published yet.</p>
          ) : (
            <div className="space-y-3">
              {data.articles.filter((a) => !query || a.title.toLowerCase().includes(query.toLowerCase())).map((a) => (
                <div key={a.slug} className="p-4 rounded-xl border border-border bg-muted/50">
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground mb-2">{a.category}</p>
                  <p className="text-sm text-foreground line-clamp-3">{a.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="neu-card rounded-2xl p-5">
          <h2 className="font-semibold text-foreground mb-4">Open a ticket</h2>
          <div className="space-y-3">
            <input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject"
              aria-label="Subject"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              aria-label="Category"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a category</option>
              {data.categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={4}
              placeholder="Describe your issue…"
              aria-label="Description"
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => void createTicket()}
              disabled={!newSubject.trim() || !newDescription.trim()}
              className="w-full py-2.5 rounded-xl gradient-blue text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Create ticket
            </button>
          </div>
        </div>
      </div>

      <div className="neu-card rounded-2xl mt-4 overflow-x-auto">
        <h2 className="font-semibold text-foreground mb-4 px-4">Your tickets</h2>
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No tickets yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-center">Priority</th>
                <th className="px-4 py-3 font-medium text-center">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.description.slice(0, 100)}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      statusVariant[t.status] === 'danger'
                        ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        : statusVariant[t.status] === 'success'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : statusVariant[t.status] === 'warning'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                            : 'bg-muted text-muted-foreground'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{t.priority}</td>
                  <td className="px-4 py-3 text-muted-foreground text-right">{t.updatedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
