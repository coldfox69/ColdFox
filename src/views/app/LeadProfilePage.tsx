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

const cardCls = 'neu-card rounded-2xl p-5';
const labelCls = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

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
      <div className="p-6">
        <EmptyState
          icon={<Mail className="w-8 h-8" />}
          title="Lead not found"
          description="This contact may have been deleted or the link is out of date."
          action={<Link href="/app/leads" className="px-4 py-2 rounded-xl gradient-blue text-white text-sm font-semibold">Back to Leads</Link>}
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
    try {
      await apiFetch(`/api/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      toast.show(message, 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const saveLead = async (updated: Lead) => {
    setBusy(true);
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
      setLead(updated);
      setEditing(false);
      toast.show('Lead updated', 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const addNote = async () => {
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/api/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ notes: note.trim() }) });
      setNotes(n => [note.trim(), ...n]);
      setNote('');
      toast.show('Note added', 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Link href="/app/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Leads & CRM
      </Link>

      <PageHeader
        title={fullName}
        description={`${lead.jobTitle} at ${lead.company}`}
        actions={
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">
            <Pencil className="w-4 h-4" /> Edit lead
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <LeadStatusBadge status={lead.status} />
        {lead.tags.map(t => (
          <span key={t} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg neu-inset-sm text-xs text-muted-foreground">
            <Tag className="w-3 h-3" /> {t}
          </span>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-muted w-full sm:w-fit overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                  tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="space-y-6">
              <div className={cardCls}>
                <h3 className="font-semibold text-foreground mb-4">Contact details</h3>
                <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div><dt className={labelCls}>Email</dt><dd className="mt-1 text-foreground break-all">{lead.email}</dd></div>
                  <div><dt className={labelCls}>Job title</dt><dd className="mt-1 text-foreground">{lead.jobTitle}</dd></div>
                  <div><dt className={labelCls}>Source</dt><dd className="mt-1 text-foreground">{lead.source}</dd></div>
                  <div><dt className={labelCls}>Added</dt><dd className="mt-1 text-foreground">{lead.createdAt}</dd></div>
                </dl>
              </div>

              <div className={cardCls}>
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /> Company</h3>
                <dl className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div><dt className={labelCls}>Company</dt><dd className="mt-1 text-foreground">{lead.company}</dd></div>
                  <div><dt className={labelCls}>Industry</dt><dd className="mt-1 text-foreground">{lead.industry ?? 'Not provided'}</dd></div>
                  <div>
                    <dt className={labelCls}>Website</dt>
                    <dd className="mt-1">
                      {lead.website
                        ? <span className="inline-flex items-center gap-1.5 text-foreground"><Globe className="w-3.5 h-3.5 text-muted-foreground" />{lead.website}</span>
                        : <span className="text-muted-foreground">Not provided</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className={labelCls}>Other contacts here</dt>
                    <dd className="mt-1 text-foreground">{coworkers.length === 0 ? 'None in your workspace' : coworkers.map(c => `${c.firstName} ${c.lastName}`).join(', ')}</dd>
                  </div>
                </dl>
              </div>

              <div className={cardCls}>
                <h3 className="font-semibold text-foreground mb-4">Pipeline</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="text-sm font-medium">
                    Status
                    <select
                      value={lead.status}
                      onChange={e => { const next = e.target.value as LeadStatus; setLead({ ...lead, status: next }); void patchLead({ status: fromLeadStatus(next) }, 'Status updated'); }}
                      className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {statusOptions.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
                    </select>
                  </label>
                  <div>
                    <p className={labelCls}>Last contacted</p>
                    <p className="mt-2 text-sm text-foreground">{lead.lastContacted ?? 'Never'}</p>
                  </div>
                </div>
                <div className="mt-5 pt-5 border-t border-border">
                  <label className="text-sm font-medium flex items-center gap-2" htmlFor="follow-up">
                    <CalendarClock className="w-4 h-4 text-muted-foreground" /> Follow-up reminder
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      id="follow-up"
                      type="date"
                      value={followUp}
                      onChange={e => setFollowUp(e.target.value)}
                      className="px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      disabled={!followUp}
                      onClick={() => { setLead({ ...lead, nextFollowUp: followUp }); void patchLead({ next_follow_up_at: new Date(`${followUp}T09:00:00Z`).toISOString() }, `Reminder set for ${followUp}`); }}
                      className="px-4 py-2.5 rounded-xl gradient-blue text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Save reminder
                    </button>
                  </div>
                </div>
              </div>

              <div className={cardCls}>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><StickyNote className="w-4 h-4 text-muted-foreground" /> Notes</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note about this contact..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button onClick={() => void addNote()} disabled={!note.trim() || busy} className="px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50 self-start">Add note</button>
                </div>
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-4">No notes yet.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {notes.map((n, i) => (
                      <li key={i} className="text-sm text-foreground p-3 rounded-xl bg-muted/60 whitespace-pre-wrap">{n}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {tab === 'conversations' && (
            <div className={cardCls}>
              {threads.length === 0 ? (
                <EmptyState icon={<MessageSquare className="w-8 h-8" />} title="No conversations yet" description="Replies and sent emails for this contact will appear here." size="sm" />
              ) : (
                <div className="space-y-4">
                  {threads.map(t => (
                    <div key={t.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-foreground text-sm">{t.subject}</p>
                        <span className="text-xs text-muted-foreground">{t.campaign}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.lastMessage}</p>
                      <p className="text-xs text-muted-foreground mt-2">{t.messages.length} messages, last activity {t.lastMessageAt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'timeline' && (
            <div className={cardCls}>
              <ol className="relative border-l border-border ml-2 space-y-5">
                {timeline.map((e, i) => (
                  <li key={i} className="ml-5">
                    <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                    <p className="text-sm text-foreground">{e.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {e.at}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className={cardCls}>
            <h3 className="font-semibold text-foreground mb-3">Campaign history</h3>
            {campaignNames.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enrolled in any campaign yet.</p>
            ) : (
              <ul className="space-y-2">
                {campaignNames.map(c => <li key={c} className="text-sm text-foreground px-3 py-2 rounded-lg bg-muted/60">{c}</li>)}
              </ul>
            )}
          </div>
          <div className={cardCls}>
            <h3 className="font-semibold text-foreground mb-3">Contact</h3>
            <a href={`mailto:${lead.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
              <Mail className="w-4 h-4 shrink-0" /> {lead.email}
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
