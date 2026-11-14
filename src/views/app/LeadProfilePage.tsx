'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Building2, Globe, Pencil, CalendarClock, MessageSquare, Clock, StickyNote, Tag } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { LeadStatusBadge } from '@/components/shared/StatusBadge';
import { useToast } from '@/components/shared/ToastProvider';
import { LeadFormModal } from '@/components/leads/LeadFormModal';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useRouter } from 'next/navigation';
import { fromLeadStatus, type LeadDetailVM, type LeadStatus, type LeadVM as Lead } from '@/lib/view-models';

type Tab = 'overview' | 'conversations' | 'timeline';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'conversations', label: 'Conversations' },
  { id: 'timeline', label: 'Timeline' },
];

const statusOptions: LeadStatus[] = ['new', 'contacted', 'replied', 'interested', 'not-interested', 'bounced', 'unsubscribed'];

const cardCls = 'neu-card rounded-[16px] p-5';
const labelCls = 'text-[12px] font-medium text-muted-foreground';
const fieldCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60';

export default function LeadProfilePage({ detail, coworkers }: { detail: LeadDetailVM; coworkers: Lead[] }) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(detail.lead);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [notes, setNotes] = useState(detail.notes.map(n => n.body));
  const [followUp, setFollowUp] = useState(detail.lead.nextFollowUp ?? '');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (!lead) {
    return (
      <div className="mx-auto max-w-xl p-6 py-16">
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title="Lead not found"
          description="This contact may have been deleted or the link is out of date."
          action={<Link href="/app/leads" className="rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground">Back to leads</Link>}
        />
      </div>
    );
  }

  const fullName = `${lead.firstName} ${lead.lastName}`.trim();
  const threads = detail.threads;
  const campaignNames = Array.from(new Set(threads.map(t => t.campaign).filter(Boolean)));

  const timeline = [
    ...(detail.activities.length
      ? detail.activities.map(a => ({ at: a.at, text: a.description || a.type.replace(/_/g, ' ') }))
      : [{ at: lead.createdAt, text: `Added via ${lead.source}` }]),
    ...(lead.nextFollowUp ? [{ at: lead.nextFollowUp, text: 'Follow-up reminder scheduled' }] : []),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const patchLead = async (payload: Record<string, unknown>, message: string) => {
    setBusy(true);
    // Optimistic: apply the change locally first so the UI never waits on the
    // server. The request is rolled back if it fails.
    const previous = lead;
    if (typeof payload.status === 'string') {
      setLead((current) => (current ? { ...current, status: payload.status as LeadStatus } : current));
    }
    try {
      await apiFetch(`/api/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast.show(message, 'success');
      router.refresh();
    } catch (error) {
      setLead(previous);
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const saveLead = async (updated: Lead) => {
    setBusy(true);
    // Optimistic: show the new values immediately, roll back on failure.
    const previous = lead;
    setLead(updated);
    setEditing(false);
    try {
      await apiFetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: updated.firstName || null,
          last_name: updated.lastName || null,
          email: updated.email,
          company_name: updated.company || null,
          job_title: updated.jobTitle || null,
          status: fromLeadStatus(updated.status),
          tags: updated.tags,
          next_follow_up_at: updated.nextFollowUp ? new Date(`${updated.nextFollowUp}T09:00:00Z`).toISOString() : null,
          notes: updated.notes || null,
        }),
      });
      toast.show('Lead updated', 'success');
      router.refresh();
    } catch (error) {
      setLead(previous);
      setEditing(true);
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim() || busy) return;
    setBusy(true);
    const text = note.trim();
    // Optimistic: the note appears immediately, and is removed again if the
    // request fails.
    setNotes((n) => [text, ...n]);
    setNote('');
    try {
      await apiFetch(`/api/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ notes: text }) });
      toast.show('Note added', 'success');
      router.refresh();
    } catch (error) {
      setNotes((n) => (n[0] === text ? n.slice(1) : n));
      setNote(text);
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <Link href="/app/leads" className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <PageHeader
        title={fullName || 'Unnamed contact'}
        description={[lead.jobTitle, lead.company].filter(Boolean).join(' at ') || lead.email}
        actions={
          <>
            <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
              <Mail className="h-4 w-4" /> Email
            </a>
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
              <Pencil className="h-4 w-4" /> Edit lead
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <LeadStatusBadge status={lead.status} />
        {lead.tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">
            <Tag className="h-3 w-3" /> {t}
          </span>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <div role="tablist" className="inline-flex w-full gap-1 overflow-x-auto rounded-[10px] border border-border bg-muted p-1 sm:w-fit" aria-label="Lead sections">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'whitespace-nowrap rounded-[8px] px-4 py-2 text-[13px] font-medium transition-colors',
                  tab === t.id ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-5">
              <div className={cardCls}>
                <h2 className="mb-4 text-[15px] font-semibold text-foreground">Contact details</h2>
                <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
                  <div><dt className={labelCls}>Email</dt><dd className="mt-1 break-all text-foreground">{lead.email}</dd></div>
                  <div><dt className={labelCls}>Job title</dt><dd className="mt-1 text-foreground">{lead.jobTitle || 'Not provided'}</dd></div>
                  <div><dt className={labelCls}>Source</dt><dd className="mt-1 capitalize text-foreground">{lead.source || 'Unknown'}</dd></div>
                  <div><dt className={labelCls}>Added</dt><dd className="mt-1 text-foreground">{lead.createdAt}</dd></div>
                </dl>
              </div>

              <div className={cardCls}>
                <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-foreground"><Building2 className="h-4 w-4 text-muted-foreground" /> Company</h2>
                <dl className="grid gap-4 text-[13px] sm:grid-cols-2">
                  <div><dt className={labelCls}>Company</dt><dd className="mt-1 text-foreground">{lead.company || 'Not provided'}</dd></div>
                  <div><dt className={labelCls}>Industry</dt><dd className="mt-1 text-foreground">{lead.industry ?? 'Not provided'}</dd></div>
                  <div>
                    <dt className={labelCls}>Website</dt>
                    <dd className="mt-1">
                      {lead.website
                        ? <span className="inline-flex items-center gap-1.5 break-all text-foreground"><Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{lead.website}</span>
                        : <span className="text-muted-foreground">Not provided</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className={labelCls}>Other contacts here</dt>
                    <dd className="mt-1 text-foreground">{coworkers.length === 0 ? 'None in your workspace' : coworkers.map(c => `${c.firstName} ${c.lastName}`.trim()).join(', ')}</dd>
                  </div>
                </dl>
              </div>

              <div className={cardCls}>
                <h2 className="mb-4 text-[15px] font-semibold text-foreground">Pipeline</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="lead-status" className="text-[13px] font-medium text-foreground">Status</label>
                    <select
                      id="lead-status"
                      value={lead.status}
                      onChange={e => { const next = e.target.value as LeadStatus; setLead({ ...lead, status: next }); void patchLead({ status: fromLeadStatus(next) }, 'Status updated'); }}
                      className={cn(fieldCls, 'mt-1.5 capitalize')}
                    >
                      {statusOptions.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className={labelCls}>Last contacted</p>
                    <p className="mt-2 text-[13px] text-foreground">{lead.lastContacted ?? 'Never'}</p>
                  </div>
                </div>
                <div className="mt-5 border-t border-border pt-5">
                  <label className="flex items-center gap-2 text-[13px] font-medium text-foreground" htmlFor="follow-up">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" /> Follow-up reminder
                  </label>
                  <p className="mt-1 text-[12px] text-muted-foreground">Set a date to come back to this contact. It appears as a reminder in your workspace.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      id="follow-up"
                      type="date"
                      value={followUp}
                      onChange={e => setFollowUp(e.target.value)}
                      className={cn(fieldCls, 'sm:w-48')}
                    />
                    <button
                      disabled={!followUp || busy}
                      onClick={() => { setLead({ ...lead, nextFollowUp: followUp }); void patchLead({ next_follow_up_at: new Date(`${followUp}T09:00:00Z`).toISOString() }, `Reminder set for ${followUp}`); }}
                      className="rounded-[10px] bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-50"
                    >
                      Save reminder
                    </button>
                  </div>
                </div>
              </div>

              <div className={cardCls}>
                <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-foreground"><StickyNote className="h-4 w-4 text-muted-foreground" /> Notes</h2>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note only your team can see…"
                    aria-label="New note"
                    className={cn(fieldCls, 'flex-1 resize-y')}
                  />
                  <button onClick={() => void addNote()} disabled={!note.trim() || busy} className="self-start rounded-[10px] border border-border bg-card px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50">Add note</button>
                </div>
                {notes.length === 0 ? (
                  <p className="mt-4 text-[13px] text-muted-foreground">No notes yet.</p>
                ) : (
                  <ul className="mt-4 space-y-2.5">
                    {notes.map((n, i) => (
                      <li key={i} className="whitespace-pre-wrap rounded-[10px] border border-border bg-muted/60 p-3 text-[13px] leading-relaxed text-foreground">{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'conversations' && (
            <div className={cardCls}>
              {threads.length === 0 ? (
                <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No conversations yet" description="Replies and sent emails for this contact will appear here." size="sm" />
              ) : (
                <div className="space-y-3">
                  {threads.map(t => (
                    <div key={t.id} className="rounded-[10px] border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-foreground">{t.subject}</p>
                        <span className="text-[12px] text-muted-foreground">{t.campaign}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{t.lastMessage}</p>
                      <p className="mt-2 text-[12px] text-muted-foreground">{t.messages.length} message{t.messages.length === 1 ? '' : 's'} · last activity {t.lastMessageAt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'timeline' && (
            <div className={cardCls}>
              {timeline.length === 0 ? (
                <EmptyState size="sm" icon={<Clock className="h-5 w-5" />} title="No activity yet" description="Campaign sends, replies, and status changes appear here." />
              ) : (
                <ol className="relative ml-2 space-y-5 border-l border-border">
                  {timeline.map((e, i) => (
                    <li key={i} className="ml-5">
                      <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                      <p className="text-[13px] text-foreground">{e.text}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground"><Clock className="h-3 w-3" /> {e.at}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className={cardCls}>
            <h2 className="mb-3 text-[15px] font-semibold text-foreground">Campaign history</h2>
            {campaignNames.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Not enrolled in any campaign yet.</p>
            ) : (
              <ul className="space-y-2">
                {campaignNames.map(c => <li key={c} className="rounded-lg bg-muted px-3 py-2 text-[13px] text-foreground">{c}</li>)}
              </ul>
            )}
          </div>
          <div className={cardCls}>
            <h2 className="mb-3 text-[15px] font-semibold text-foreground">Contact</h2>
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 break-all text-[13px] text-accent-foreground hover:underline">
              <Mail className="h-4 w-4 shrink-0" /> {lead.email}
            </a>
          </div>
        </aside>
      </div>

      {editing && (
        <LeadFormModal lead={lead} onClose={() => setEditing(false)} onSave={(updated) => void saveLead(updated)} />
      )}
    </div>
  );
}
