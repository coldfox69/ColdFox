'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Loader2, AlertTriangle, Search,
  Clock, Zap, CalendarClock, ShieldCheck, Users, FileText, Layers, Sparkles, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/shared/ToastProvider';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { type CampaignVM, type MailboxVM, type TemplateVM } from '@/lib/view-models';

const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';
const cardCls = 'neu-card rounded-[16px] p-5 sm:p-6';

const steps = ['Basics', 'Lead list', 'Template', 'Sending', 'Review'] as const;

// Module-scope time anchor: render stays pure, and "tomorrow" defaults are stable for the session.
const NOW_MS = Date.now();
const TOMORROW_ISO = new Date(NOW_MS + 86_400_000).toISOString().slice(0, 10);
const DETECTED_TZ = typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') : 'UTC';

const intervalPresets = [
  { id: '10-20', label: '10-20 seconds', min: 10, max: 20 },
  { id: '20-40', label: '20-40 seconds', min: 20, max: 40 },
  { id: '30-70', label: '30-70 seconds', min: 30, max: 70, recommended: true },
  { id: '40-80', label: '40-80 seconds', min: 40, max: 80 },
  { id: '60-120', label: '60-120 seconds', min: 60, max: 120 },
] as const;
type IntervalPreset = (typeof intervalPresets)[number]['id'];

const timezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid',
  'Africa/Cairo', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka',
  'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

interface LeadListSummary {
  id: string;
  name: string;
  description: string | null;
  filename: string | null;
  source: string;
  stats: { total_rows?: number; valid_rows?: number; invalid_rows?: number; duplicate_rows?: number };
  leadCount: number;
  createdAt: string;
}

interface LeadListPreviewRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  industry: string | null;
}

interface LeadListPreview extends LeadListSummary {
  eligibleCount: number;
  suppressedCount: number;
  preview: LeadListPreviewRow[];
  note?: string;
}

export default function CampaignWizardPage({
  initialMailboxes,
  initialTemplates,
}: {
  initialMailboxes: MailboxVM[];
  initialTemplates: TemplateVM[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmLaunch, setConfirmLaunch] = useState(false);
  const [launched, setLaunched] = useState<{ mode: 'now' | 'schedule' | 'draft'; name: string; start?: string; id?: string } | null>(null);

  // Step 1 - basics
  const [details, setDetails] = useState({
    name: '',
    description: '',
    mailboxId: initialMailboxes.find((m) => m.status === 'connected')?.id ?? initialMailboxes[0]?.id ?? '',
    mode: 'now' as 'now' | 'schedule',
    startDate: TOMORROW_ISO,
    startTime: '09:00',
    timezone: DETECTED_TZ,
  });

  // Step 2 - lead list
  const [leadLists, setLeadLists] = useState<LeadListSummary[] | null>(null);
  const [listsError, setListsError] = useState('');
  const [selectedListId, setSelectedListId] = useState('');
  const [preview, setPreview] = useState<LeadListPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [previewQuery, setPreviewQuery] = useState('');

  // Step 3 - template
  const [templateKind, setTemplateKind] = useState<'single' | 'group'>('single');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Step 4 - sending
  const [intervalPreset, setIntervalPreset] = useState<IntervalPreset>('30-70');
  const [dailyCap, setDailyCap] = useState(100);
  const [stopOnReply, setStopOnReply] = useState(true);

  // Step 5 - review samples
  const [sampleBusy, setSampleBusy] = useState(false);
  const [samples, setSamples] = useState<{ lead_id: string; email: string; subject: string; body: string; ai: boolean; notes: string[] }[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lists = await apiFetch<LeadListSummary[]>('/api/lead-lists');
        if (!cancelled) setLeadLists(lists);
      } catch (cause) {
        if (!cancelled) {
          setListsError(errorMessage(cause));
          setLeadLists([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const templatesSingle = initialTemplates.filter((t) => t.mode !== 'group');
  const templatesGroup = initialTemplates.filter((t) => t.mode === 'group');
  const shownTemplates = templateKind === 'single' ? templatesSingle : templatesGroup;
  const selectedTemplate = initialTemplates.find((t) => t.id === selectedTemplateId) ?? null;
  const selectedMailbox = initialMailboxes.find((m) => m.id === details.mailboxId) ?? null;

  const hasLeadList = (leadLists ?? []).some((list) => list.leadCount > 0);
  const prereqs = { leadList: hasLeadList, template: initialTemplates.length > 0 };

  const handleSelectList = (id: string) => {
    setSelectedListId(id);
    setPreview(null);
    setExcluded(new Set());
    setPreviewQuery('');
    setPreviewLoading(Boolean(id));
  };

  useEffect(() => {
    if (!selectedListId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<LeadListPreview>(`/api/lead-lists/${selectedListId}?leads=1`);
        if (!cancelled) setPreview(data);
      } catch (cause) {
        if (!cancelled) toast.show(errorMessage(cause), 'danger');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedListId]);

  const filteredPreview = useMemo(() => {
    const rows = preview?.preview ?? [];
    const q = previewQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.email, row.firstName ?? '', row.company ?? '', row.jobTitle ?? ''].join(' ').toLowerCase().includes(q));
  }, [preview, previewQuery]);

  const eligibleTotal = preview ? preview.eligibleCount : 0;
  const excludedCount = excluded.size;
  const recipients = Math.max(0, eligibleTotal - excludedCount);
  const excludedIds = [...excluded];

  const scheduledAt = useMemo(() => {
    if (details.mode !== 'schedule') return null;
    const iso = `${details.startDate}T${details.startTime}:00`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [details.mode, details.startDate, details.startTime]);

  const issues = useMemo(() => {
    const list: { level: 'error' | 'warning'; message: string }[] = [];
    if (!prereqs.leadList) list.push({ level: 'error', message: 'Please upload a lead list before creating your campaign.' });
    if (!prereqs.template) list.push({ level: 'error', message: 'Please create an email template before creating your campaign.' });
    if (!details.name.trim()) list.push({ level: 'error', message: 'Give your campaign a name.' });
    if (!selectedMailbox) list.push({ level: 'error', message: 'Choose a sending mailbox.' });
    else if (selectedMailbox.status !== 'connected') list.push({ level: 'error', message: `${selectedMailbox.email} is not connected. Reconnect it or choose another mailbox.` });
    if (details.mode === 'schedule') {
      if (!scheduledAt) list.push({ level: 'error', message: 'Choose a valid start date and time.' });
      else if (scheduledAt.getTime() <= NOW_MS + 60_000) list.push({ level: 'error', message: 'The scheduled time must be in the future.' });
    }
    if (step >= 1 && !selectedListId) list.push({ level: 'error', message: 'Select a lead list for this campaign.' });
    if (step >= 1 && selectedListId && preview && recipients === 0) list.push({ level: 'error', message: 'Every eligible lead is excluded. Include at least one recipient.' });
    if (step >= 2 && !selectedTemplateId) list.push({ level: 'error', message: 'Select a template for this campaign.' });
    if (dailyCap < 1 || dailyCap > 2000) list.push({ level: 'error', message: 'Daily limit must be between 1 and 2000.' });
    return list;
  }, [prereqs.leadList, prereqs.template, details.name, details.mode, scheduledAt, selectedMailbox, step, selectedListId, preview, recipients, selectedTemplateId, dailyCap]);

  const canContinue = !issues.some((issue) => issue.level === 'error');

  const next = () => {
    if (!canContinue) {
      setError(issues.find((issue) => issue.level === 'error')?.message ?? 'Fix the highlighted issues before continuing.');
      return;
    }
    setError('');
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };
  const prev = () => { setError(''); setStep((current) => Math.max(0, current - 1)); };

  const loadSamples = useCallback(async () => {
    if (!selectedTemplateId) return;
    setSampleBusy(true);
    try {
      const result = await apiFetch<{ samples: typeof samples }>(`/api/templates/${selectedTemplateId}/personalize-sample`, {
        method: 'POST',
        body: JSON.stringify({ lead_list_id: selectedListId }),
      });
      setSamples(result.samples);
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setSampleBusy(false);
    }
  }, [selectedTemplateId, selectedListId, toast]);

  // Auto-load samples once the review step is shown; setStates only happen after the await.
  useEffect(() => {
    if (step !== steps.length - 1 || !selectedTemplateId) return;
    let cancelled = false;
    void (async () => {
      try {
        const result = await apiFetch<{ samples: typeof samples }>(`/api/templates/${selectedTemplateId}/personalize-sample`, {
          method: 'POST',
          body: JSON.stringify({ lead_list_id: selectedListId }),
        });
        if (!cancelled) setSamples(result.samples);
      } catch {
        // Sample generation is best-effort; the refresh button surfaces errors.
      }
    })();
    return () => { cancelled = true; };
  }, [step, selectedTemplateId, selectedListId]);

  const toggleExcluded = (id: string, checked: boolean) => {
    setExcluded((prev) => {
      const nextSet = new Set(prev);
      if (checked) nextSet.delete(id); else nextSet.add(id);
      return nextSet;
    });
  };

  const createCampaign = async () => {
    if (!selectedTemplate || !selectedListId) throw new Error('Select a template and a lead list.');
    const preset = intervalPresets.find((p) => p.id === intervalPreset) ?? intervalPresets[2];
    return apiFetch<CampaignVM & { excluded?: number }>('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: details.name.trim(),
        description: details.description.trim() || null,
        mailbox_id: details.mailboxId,
        template_id: selectedTemplate.id,
        lead_list_id: selectedListId,
        exclude_lead_ids: excludedIds,
        timezone: details.timezone,
        daily_limit: dailyCap,
        stop_on_reply: stopOnReply,
        interval_min_seconds: preset.min,
        interval_max_seconds: preset.max,
        ai_personalization: selectedTemplate.aiPersonalization,
        send_window_start: '09:00',
        send_window_end: '17:00',
        weekdays: [1, 2, 3, 4, 5],
      }),
    });
  };

  const createAndLaunch = async (launchMode: 'now' | 'schedule' | 'draft') => {
    setBusy(true);
    setError('');
    try {
      const campaign = await createCampaign();
      if (launchMode === 'draft') {
        setLaunched({ mode: 'draft', name: details.name.trim(), id: campaign.id });
        return;
      }
      const sendAt = launchMode === 'schedule' && scheduledAt ? scheduledAt.toISOString() : undefined;
      const launch = await apiFetch<{ status: string; queued?: number; sendAt?: string }>(
        `/api/campaigns/${campaign.id}/launch`,
        { method: 'POST', body: JSON.stringify({ mode: launchMode, send_at: sendAt }) },
      );
      setLaunched({ mode: launchMode, name: details.name.trim(), start: launch.sendAt ?? undefined, id: campaign.id });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      setConfirmLaunch(false);
    }
  };

  if (launched) {
    const title = launched.mode === 'draft' ? 'Saved as draft' : launched.mode === 'now' ? 'Campaign launched' : 'Campaign scheduled';
    const body = launched.mode === 'draft'
      ? `"${launched.name}" was saved as a draft. Launch it whenever you are ready.`
      : launched.mode === 'now'
        ? `"${launched.name}" is now sending. Replies will appear in your Unified Inbox.`
        : `"${launched.name}" will start at ${launched.start ? new Date(launched.start).toLocaleString() : 'the scheduled time'}.`;
    return (
      <div className="p-6 lg:p-10 max-w-xl mx-auto text-center">
        <div className={`${cardCls} mt-10`}>
          <div className="w-16 h-16 rounded-[16px] neu-inset-sm flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-[var(--cf-success)]" />
          </div>
          <h1 className="text-[20px] font-semibold text-foreground mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground mb-8">{body}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {launched.id && launched.mode === 'draft' ? (
              <button onClick={() => router.push(`/app/campaigns/${launched.id}`)} className="px-5 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-110">Review draft</button>
            ) : (
              <button onClick={() => router.push(launched.id ? `/app/campaigns/${launched.id}` : '/app/campaigns')} className="px-5 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-110">View campaign</button>
            )}
            <button onClick={() => router.push('/app/inbox')} className="px-5 py-2.5 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised)]">Open inbox</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto">
      <Link href="/app/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" /> Back to campaigns</Link>
      <PageHeader title="New campaign" description="Pick a lead list, pick a template, then let the engine send at a controlled pace." />

      <ol className="flex items-center gap-2 mb-6 overflow-x-auto pb-1" aria-label="Campaign steps">
        {steps.map((label, index) => (
          <li key={label} className="flex items-center gap-2 flex-shrink-0">
            <button type="button" disabled={index > step} onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined}
              className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:cursor-default',
                index === step ? 'rounded-[10px] bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)]' : index < step ? 'neu-inset-sm text-muted-foreground' : 'bg-muted text-muted-foreground')}>
              {index < step ? <Check className="w-3.5 h-3.5" /> : <span>{index + 1}</span>} {label}
            </button>
            {index < steps.length - 1 && <span className="w-6 h-px bg-border" />}
          </li>
        ))}
      </ol>

      {/* Prerequisite banner */}
      {(!prereqs.leadList || !prereqs.template) && (
        <div className="mb-4 rounded-[16px] border border-[var(--cf-warning)]/40 bg-[var(--cf-warning)]/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-foreground"><AlertTriangle className="w-4 h-4" /> Set these up first</p>
          <ul className="mt-2 space-y-1.5">
            {!prereqs.leadList && (
              <li className="flex flex-wrap items-center gap-2 text-muted-foreground">
                Please upload a lead list before creating your campaign.
                <Link href="/app/lead-lists#new" className="font-medium text-accent-foreground hover:underline">Add lead list</Link>
              </li>
            )}
            {!prereqs.template && (
              <li className="flex flex-wrap items-center gap-2 text-muted-foreground">
                Please create an email template before creating your campaign.
                <Link href="/app/templates" className="font-medium text-accent-foreground hover:underline">Create template</Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className={cardCls}>
        {step === 0 && (
          <div className="grid gap-5 max-w-2xl">
            <div>
              <label htmlFor="cname" className="text-sm font-medium mb-1.5 block">Campaign name</label>
              <input id="cname" className={inputCls} value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} placeholder="Q4 SaaS founders outreach" autoFocus />
            </div>
            <div>
              <label htmlFor="cdesc" className="text-sm font-medium mb-1.5 block">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea id="cdesc" rows={2} className={inputCls} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} placeholder="Who this targets and the goal" />
            </div>
            <fieldset>
              <legend className="text-sm font-medium mb-2">Sending mailbox</legend>
              <select id="cmailbox" aria-label="Sending mailbox" className={inputCls} value={details.mailboxId} onChange={(event) => setDetails({ ...details, mailboxId: event.target.value })}>
                {initialMailboxes.length === 0 && <option value="">No mailboxes connected</option>}
                {initialMailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>{mailbox.email}{mailbox.status === 'connected' ? '' : ' (not connected)'}</option>
                ))}
              </select>
              {selectedMailbox && selectedMailbox.status !== 'connected' && (
                <p className="mt-2 text-sm text-[var(--cf-warning)] flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> This mailbox is not connected. Reconnect it from the Mailboxes page.</p>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium mb-2">Sending mode</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <button type="button" aria-pressed={details.mode === 'now'} onClick={() => setDetails({ ...details, mode: 'now' })}
                  className={cn('rounded-[16px] border p-4 text-left transition-shadow', details.mode === 'now' ? 'border-primary bg-primary/5 shadow-[var(--shadow-raised-sm)]' : 'border-border hover:border-primary/50')}>
                  <Zap className="w-5 h-5 text-primary mb-2" />
                  <span className="block text-sm font-semibold text-foreground">Instant sending</span>
                  <span className="block text-[12px] text-muted-foreground mt-1">Queues every recipient immediately after validation and launch confirmation.</span>
                </button>
                <button type="button" aria-pressed={details.mode === 'schedule'} onClick={() => setDetails({ ...details, mode: 'schedule' })}
                  className={cn('rounded-[16px] border p-4 text-left transition-shadow', details.mode === 'schedule' ? 'border-primary bg-primary/5 shadow-[var(--shadow-raised-sm)]' : 'border-border hover:border-primary/50')}>
                  <CalendarClock className="w-5 h-5 text-primary mb-2" />
                  <span className="block text-sm font-semibold text-foreground">Schedule campaign</span>
                  <span className="block text-[12px] text-muted-foreground mt-1">Starts sending at the chosen time in the selected timezone. Timestamps are stored in UTC.</span>
                </button>
              </div>
              {details.mode === 'schedule' && (
                <div className="mt-3 grid sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="sdate" className="text-[12px] font-medium text-muted-foreground mb-1 block">Start date</label>
                    <input id="sdate" type="date" className={inputCls} value={details.startDate} min={TOMORROW_ISO} onChange={(event) => setDetails({ ...details, startDate: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="stime" className="text-[12px] font-medium text-muted-foreground mb-1 block">Start time</label>
                    <input id="stime" type="time" className={inputCls} value={details.startTime} onChange={(event) => setDetails({ ...details, startTime: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="stimezone" className="text-[12px] font-medium text-muted-foreground mb-1 block">Timezone</label>
                    <select id="stimezone" className={inputCls} value={details.timezone} onChange={(event) => setDetails({ ...details, timezone: event.target.value })}>
                      {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Select a lead list</h2>
              <Link href="/app/lead-lists#new" className="text-[12px] font-medium text-accent-foreground hover:underline">Add lead list</Link>
            </div>
            {listsError && <p role="alert" className="text-sm text-destructive">{listsError}</p>}
            {leadLists === null ? (
              <div className="rounded-[16px] border border-border p-6 flex items-center gap-3 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading your lead lists...</div>
            ) : leadLists.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lead lists yet. <Link href="/app/lead-lists#new" className="font-medium text-accent-foreground hover:underline">Add lead list</Link> to continue.</p>
            ) : (
              <div>
                <label htmlFor="cllist" className="text-sm font-medium mb-1.5 block">Lead list</label>
                <select id="cllist" className={inputCls} value={selectedListId} onChange={(event) => handleSelectList(event.target.value)}>
                  <option value="">Choose a list...</option>
                  {leadLists.filter((list) => list.leadCount > 0).map((list) => (
                    <option key={list.id} value={list.id}>{list.name}  |  {list.leadCount} leads  |  added {new Date(list.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedListId && (
              previewLoading || !preview ? (
                <div className="rounded-[16px] border border-border p-6 flex items-center gap-3 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Checking suppression list and eligibility...</div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-[16px] neu-inset-sm p-4 text-[12px]">
                    <div><span className="text-muted-foreground">Total leads</span><br /><span className="text-lg font-semibold text-foreground">{preview.leadCount}</span></div>
                    <div><span className="text-muted-foreground">Valid to email</span><br /><span className="text-lg font-semibold text-[var(--cf-success)]">{preview.eligibleCount}</span></div>
                    <div><span className="text-muted-foreground">Suppressed</span><br /><span className="text-lg font-semibold text-foreground">{preview.suppressedCount}</span></div>
                    <div><span className="text-muted-foreground">Excluded by you</span><br /><span className="text-lg font-semibold text-[var(--cf-warning)]">{excludedCount}</span></div>
                    <div><span className="text-muted-foreground">Will receive</span><br /><span className="text-lg font-semibold text-accent-foreground">{recipients}</span></div>
                  </div>
                  <p className="text-[12px] text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-[var(--cf-success)]" /> Unsubscribes, hard bounces, complaints and reply-based opt-outs are always skipped, and the suppression list is checked again immediately before every send.</p>
                  <div className="rounded-[16px] border border-border overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground">Recipient preview <span className="text-muted-foreground font-normal">(first {preview.preview.length})</span></p>
                      <div className="relative sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input value={previewQuery} onChange={(event) => setPreviewQuery(event.target.value)} placeholder="Filter recipients" aria-label="Filter recipients" className="w-full pl-8 pr-3 py-1.5 rounded-[8px] bg-input text-[12px] outline-none focus:ring-2 focus:ring-ring" />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-[12px]">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                          <tr><th className="px-3 py-2 w-8"></th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Job title</th></tr>
                        </thead>
                        <tbody>
                          {filteredPreview.map((row) => {
                            const included = !excluded.has(row.id);
                            return (
                              <tr key={row.id} className="border-t border-border hover:bg-muted/40">
                                <td className="px-3 py-2"><input type="checkbox" aria-label={`Include ${row.email}`} checked={included} onChange={(event) => toggleExcluded(row.id, event.target.checked)} className="h-4 w-4 accent-primary" /></td>
                                <td className="px-3 py-2 font-medium text-foreground">{row.email}</td>
                                <td className="px-3 py-2 text-muted-foreground">{[row.firstName, row.lastName].filter(Boolean).join(' ') || '-'}</td>
                                <td className="px-3 py-2 text-muted-foreground">{row.company ?? '-'}</td>
                                <td className="px-3 py-2 text-muted-foreground">{row.jobTitle ?? '-'}</td>
                              </tr>
                            );
                          })}
                          {filteredPreview.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No recipients match this filter.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {preview.note && <p className="text-[11px] text-muted-foreground px-3 py-2 border-t border-border">{preview.note}</p>}
                  </div>
                </>
              )
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Select a template</h2>
              <div className="inline-flex gap-1 rounded-[10px] bg-input p-1 shadow-[var(--shadow-inset-sm)]" role="tablist" aria-label="Template type">
                {([['single', 'Single Template'], ['group', 'Multiple Templates']] as const).map(([kind, label]) => (
                  <button key={kind} role="tab" aria-selected={templateKind === kind} onClick={() => { setTemplateKind(kind); setSelectedTemplateId(''); }}
                    className={cn('rounded-[8px] px-3 py-1.5 text-[12px] font-medium', templateKind === kind ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {shownTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {templateKind === 'single' ? 'single' : 'group'} templates yet. <Link href="/app/templates" className="font-medium text-accent-foreground hover:underline">Create one</Link> to continue.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {shownTemplates.map((template) => {
                  const active = selectedTemplateId === template.id;
                  return (
                    <li key={template.id}>
                      <button type="button" onClick={() => setSelectedTemplateId(template.id)} aria-pressed={active}
                        className={cn('w-full text-left rounded-[16px] border p-4 transition-shadow', active ? 'border-primary bg-primary/5 shadow-[var(--shadow-raised-sm)]' : 'border-border hover:border-primary/50')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {template.mode === 'group' ? <Layers className="w-4 h-4 text-primary shrink-0" /> : <FileText className="w-4 h-4 text-primary shrink-0" />}
                            <span className="text-sm font-semibold text-foreground truncate">{template.name}</span>
                          </div>
                          {active && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </div>
                        <p className="mt-2 text-[12px] text-muted-foreground line-clamp-2">{template.subject}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Updated {template.updatedAt}</span>
                          {template.mode === 'group' && <span>{template.variants.length} variants</span>}
                          {template.aiReviewed && <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-[var(--cf-success)]" /> AI reviewed</span>}
                          {template.aiPersonalization && <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" /> AI personalized</span>}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedTemplate && (
              <div className="rounded-[16px] border border-border p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Preview</p>
                <p className="text-[13px] font-semibold text-foreground">{selectedTemplate.subject}</p>
                <p className="mt-2 text-[13px] whitespace-pre-wrap text-foreground/90 max-h-48 overflow-y-auto">{selectedTemplate.body}</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 max-w-2xl">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Sending configuration</h2>
            <dl className="grid grid-cols-2 gap-3 rounded-[16px] neu-inset-sm p-4 text-[12px]">
              <div><dt className="text-muted-foreground">Mailbox</dt><dd className="font-medium text-foreground">{selectedMailbox?.email}</dd></div>
              <div><dt className="text-muted-foreground">Template</dt><dd className="font-medium text-foreground">{selectedTemplate?.name}</dd></div>
              <div><dt className="text-muted-foreground">Recipients</dt><dd className="font-medium text-foreground">{recipients}</dd></div>
              <div><dt className="text-muted-foreground">Mode</dt><dd className="font-medium text-foreground">{details.mode === 'now' ? 'Instant' : `Scheduled ${scheduledAt ? scheduledAt.toLocaleString() : ''}`}</dd></div>
            </dl>

            <fieldset>
              <legend className="text-sm font-medium mb-2">Sending interval</legend>
              <p className="text-[12px] text-muted-foreground mb-2">A random pause from the selected range is applied between eligible sends. This spreads load and avoids sudden bursts; it is not a way to evade provider filters.</p>
              <select aria-label="Sending interval" className={inputCls} value={intervalPreset} onChange={(event) => setIntervalPreset(event.target.value as IntervalPreset)}>
                {intervalPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}{'recommended' in preset && preset.recommended ? ' (Recommended)' : ''}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1"><Info className="w-3 h-3" /> Provider and mailbox daily limits are enforced as well; if your provider requires longer pauses, the engine respects them.</p>
            </fieldset>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="daily-cap" className="text-sm font-medium mb-1.5 block">Max per day (campaign)</label>
                <input id="daily-cap" type="number" min={1} max={2000} className={inputCls} value={dailyCap} onChange={(event) => setDailyCap(Math.max(1, Math.min(2000, Number(event.target.value) || 1)))} />
                {selectedMailbox && <p className="text-[11px] text-muted-foreground mt-1.5">Mailbox daily limit: {selectedMailbox.sentToday}/{selectedMailbox.dailyLimit} sent today.</p>}
              </div>
              <label className="flex flex-col justify-center gap-1.5 rounded-[16px] border border-border p-4 cursor-pointer select-none">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={stopOnReply} onChange={(event) => setStopOnReply(event.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
                  <span className="text-sm font-medium text-foreground">Stop on reply</span>
                </span>
                <span className="text-[11px] text-muted-foreground">Recipients who reply are never emailed again by this campaign.</span>
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-foreground">Campaign overview</h2>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
              {[
                ['Campaign name', details.name.trim() || '-'],
                ['Sending mailbox', selectedMailbox?.email ?? '-'],
                ['Sending mode', details.mode === 'now' ? 'Instant sending (on confirm)' : `Scheduled for ${scheduledAt?.toLocaleString() ?? '-'} (${details.timezone})`],
                ['Lead list', leadLists?.find((l) => l.id === selectedListId)?.name ?? selectedListId],
                ['Total leads', String(preview?.leadCount ?? '-')],
                ['Valid recipients', String(eligibleTotal)],
                ['Excluded recipients', String(excludedCount)],
                ['Template type', templateKind === 'group' ? 'Multiple (rotating variants)' : 'Single'],
                ['Template', selectedTemplate?.name ?? '-'],
                ['Variants', selectedTemplate?.mode === 'group' ? String(selectedTemplate.variants.length) : '1'],
                ['AI personalization', selectedTemplate?.aiPersonalization ? 'Enabled' : 'Disabled'],
                ['Stop on reply', stopOnReply ? 'Yes' : 'No'],
                ['Sending interval', intervalPresets.find((p) => p.id === intervalPreset)?.label ?? '30-70 seconds'],
                ['Max per day', String(dailyCap)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col border-b border-border pb-2">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                  <dd className="font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-[16px] border border-border p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-sm font-semibold text-foreground">Personalized samples <span className="text-muted-foreground font-normal">(actual lead data)</span></p>
                <button type="button" onClick={() => void loadSamples()} disabled={sampleBusy} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">{sampleBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Refresh</button>
              </div>
              {samples.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">{sampleBusy ? 'Generating samples...' : 'No samples yet. If the template uses AI personalization, generation takes a few seconds per sample.'}</p>
              ) : (
                <ul className="grid gap-3">
                  {samples.map((sample) => (
                    <li key={sample.lead_id} className="rounded-xl bg-card border border-border p-3">
                      <p className="text-[12px] font-medium text-muted-foreground">{sample.email}{sample.ai ? '  |  AI personalized' : ''}</p>
                      <p className="text-[13px] font-semibold text-foreground mt-1">{sample.subject}</p>
                      <p className="text-[13px] whitespace-pre-wrap text-foreground/90 mt-1">{sample.body}</p>
                      {sample.notes.length > 0 && <p className="text-[11px] text-muted-foreground mt-2">{sample.notes.join('  |  ')}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Unsubscribed and bounced addresses can never receive campaign email, even if they are in this list.</p>
            {issues.some((issue) => issue.level === 'error') && (
              <ul className="rounded-[16px] border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive space-y-1">
                {issues.filter((issue) => issue.level === 'error').map((issue) => <li key={issue.message} className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{issue.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
        <button type="button" onClick={prev} disabled={step === 0 || busy} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          {step < steps.length - 1 && (
            <button type="button" onClick={next} disabled={busy} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-110 disabled:opacity-60">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {step === steps.length - 1 && (
            <>
              <button type="button" onClick={() => void createAndLaunch('draft')} disabled={busy || issues.some((issue) => issue.level === 'error')}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised)] disabled:opacity-50 disabled:cursor-not-allowed">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save as draft
              </button>
              <button type="button" onClick={() => (details.mode === 'now' ? setConfirmLaunch(true) : void createAndLaunch('schedule'))} disabled={busy || issues.some((issue) => issue.level === 'error')}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
                {details.mode === 'now' ? <Zap className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                {busy ? 'Creating...' : details.mode === 'now' ? 'Start campaign' : 'Create & schedule'}
              </button>
            </>
          )}
        </div>
      </div>

      {confirmLaunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmLaunch(false)} aria-hidden="true" />
          <div role="alertdialog" aria-modal="true" aria-labelledby="launch-confirm-title" className="relative w-full max-w-md neu-card rounded-[16px] p-6">
            <h2 id="launch-confirm-title" className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2"><Zap className="w-5 h-5 text-primary" /> Start sending now?</h2>
            <p className="text-sm text-muted-foreground">
              &quot;{details.name.trim()}&quot; will begin sending to <span className="font-medium text-foreground">{recipients} recipients</span> through {selectedMailbox?.email}. Each send uses your configured interval and the mailbox daily limit. You can pause the campaign at any time.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setConfirmLaunch(false)} className="px-4 py-2 rounded-[10px] border border-border text-sm font-medium hover:bg-muted">Back</button>
              <button type="button" onClick={() => void createAndLaunch('now')} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Launch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
