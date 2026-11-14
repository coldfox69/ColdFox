'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { COMMON_TIMEZONES, zonedDateTimeToUtc } from '@/lib/timezone';

const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60';
const cardCls = 'neu-card rounded-[16px] p-5 sm:p-6';
const primaryBtn = 'inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:pointer-events-none disabled:opacity-60';
const secondaryBtn = 'inline-flex items-center gap-2 rounded-[10px] border border-border bg-card px-4 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50';
const labelCls = 'mb-1.5 block text-[13px] font-medium text-foreground';
const hintCls = 'text-[12px] leading-relaxed text-muted-foreground';

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

const timezones = COMMON_TIMEZONES.includes(DETECTED_TZ) ? COMMON_TIMEZONES : [DETECTED_TZ, ...COMMON_TIMEZONES];

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
  // A create call can succeed before the launch call fails. Remember the
  // campaign (keyed by its exact payload) so retrying reuses it instead of
  // creating a duplicate draft on every attempt.
  const createdCampaign = useRef<{ id: string; payload: string } | null>(null);

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
    // Interpret the picked date and time in the timezone the user chose, not
    // the browser's zone. The engine schedules the send in that same zone.
    return zonedDateTimeToUtc(details.startDate, details.startTime, details.timezone);
  }, [details.mode, details.startDate, details.startTime, details.timezone]);

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
    const payload = {
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
    };
    const serialized = JSON.stringify(payload);
    if (createdCampaign.current?.payload === serialized) {
      return { id: createdCampaign.current.id };
    }
    const campaign = await apiFetch<CampaignVM & { excluded?: number }>('/api/campaigns', {
      method: 'POST',
      body: serialized,
    });
    createdCampaign.current = { id: campaign.id, payload: serialized };
    return campaign;
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
      <div className="mx-auto max-w-xl px-6 py-10">
        <div className={`${cardCls} mt-10 text-center`}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[16px] bg-[var(--cf-success)]/10">
            <CheckCircle2 className="h-8 w-8 text-[var(--cf-success)]" />
          </div>
          <h1 className="mb-2 text-[20px] font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
          <p className="mb-8 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            {launched.id && launched.mode === 'draft' ? (
              <button onClick={() => router.push(`/app/campaigns/${launched.id}`)} className={primaryBtn}>Review draft</button>
            ) : (
              <button onClick={() => router.push(launched.id ? `/app/campaigns/${launched.id}` : '/app/campaigns')} className={primaryBtn}>View campaign</button>
            )}
            <button onClick={() => router.push('/app/inbox')} className={secondaryBtn}>Open inbox</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-6 py-6 lg:px-8 lg:py-8">
      <Link href="/app/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to campaigns</Link>
      <PageHeader title="New campaign" description="Five short steps: name it, choose your leads, pick a template, set the pace, then review." />

      <ol className="mb-6 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Campaign steps">
        {steps.map((label, index) => (
          <li key={label} className="flex flex-shrink-0 items-center gap-2">
            <button type="button" disabled={index > step} onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined}
              className={cn('flex items-center gap-2 rounded-[9px] px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-default',
                index === step ? 'bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)]' : index < step ? 'border border-border bg-card text-foreground' : 'bg-muted text-muted-foreground')}>
              {index < step ? <Check className="h-3.5 w-3.5" /> : <span>{index + 1}</span>} {label}
            </button>
            {index < steps.length - 1 && <span className="h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      {/* Prerequisite banner */}
      {(!prereqs.leadList || !prereqs.template) && (
        <div className="mb-4 rounded-[12px] border border-[var(--cf-warning)]/40 bg-[var(--cf-warning)]/10 p-4 text-[13px]">
          <p className="flex items-center gap-2 font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-[var(--cf-warning)]" /> Set these up first</p>
          <ul className="mt-2 space-y-1.5">
            {!prereqs.leadList && (
              <li className="flex flex-wrap items-center gap-2 text-muted-foreground">
                You need a lead list before creating a campaign.
                <Link href="/app/lead-lists#new" className="font-medium text-accent-foreground hover:underline">Add lead list</Link>
              </li>
            )}
            {!prereqs.template && (
              <li className="flex flex-wrap items-center gap-2 text-muted-foreground">
                You need an email template before creating a campaign.
                <Link href="/app/templates" className="font-medium text-accent-foreground hover:underline">Create template</Link>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className={cardCls}>
        {step === 0 && (
          <div className="grid max-w-2xl gap-5">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Campaign basics</h2>
              <p className={cn(hintCls, 'mt-0.5')}>A campaign is one template sent to one lead list from one mailbox.</p>
            </div>
            <div>
              <label htmlFor="cname" className={labelCls}>Campaign name</label>
              <input id="cname" className={inputCls} value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} placeholder="Q4 SaaS founders outreach" autoFocus />
            </div>
            <div>
              <label htmlFor="cdesc" className={labelCls}>Description <span className="font-normal text-muted-foreground">(optional)</span></label>
              <textarea id="cdesc" rows={2} className={inputCls} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} placeholder="Who this targets and the goal" />
            </div>
            <fieldset>
              <legend className={labelCls}>Sending mailbox</legend>
              <select id="cmailbox" aria-label="Sending mailbox" className={inputCls} value={details.mailboxId} onChange={(event) => setDetails({ ...details, mailboxId: event.target.value })}>
                {initialMailboxes.length === 0 && <option value="">No mailboxes connected</option>}
                {initialMailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>{mailbox.email}{mailbox.status === 'connected' ? '' : ' (not connected)'}</option>
                ))}
              </select>
              {selectedMailbox && selectedMailbox.status !== 'connected' && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--cf-warning)]"><AlertTriangle className="h-4 w-4" /> This mailbox is not connected. Reconnect it on the Mailboxes page, or choose another one.</p>
              )}
              <p className={cn(hintCls, 'mt-1.5')}>All sends use this mailbox so replies land in one inbox.</p>
            </fieldset>

            <fieldset>
              <legend className={labelCls}>When should it send?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" aria-pressed={details.mode === 'now'} onClick={() => setDetails({ ...details, mode: 'now' })}
                  className={cn('rounded-[12px] border p-4 text-left transition-[border-color,box-shadow]', details.mode === 'now' ? 'border-primary bg-primary/[0.04] shadow-[var(--shadow-raised-sm)]' : 'border-border bg-card hover:border-primary/50')}>
                  <Zap className="mb-2 h-5 w-5 text-primary" />
                  <span className="block text-[13px] font-semibold text-foreground">Start right away</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">Queues every eligible recipient as soon as you confirm. You can pause at any time.</span>
                </button>
                <button type="button" aria-pressed={details.mode === 'schedule'} onClick={() => setDetails({ ...details, mode: 'schedule' })}
                  className={cn('rounded-[12px] border p-4 text-left transition-[border-color,box-shadow]', details.mode === 'schedule' ? 'border-primary bg-primary/[0.04] shadow-[var(--shadow-raised-sm)]' : 'border-border bg-card hover:border-primary/50')}>
                  <CalendarClock className="mb-2 h-5 w-5 text-primary" />
                  <span className="block text-[13px] font-semibold text-foreground">Schedule for later</span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">Pick a date, time, and timezone. Nothing sends until that moment.</span>
                </button>
              </div>
              {details.mode === 'schedule' && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="sdate" className="mb-1 block text-[12px] font-medium text-foreground">Start date</label>
                    <input id="sdate" type="date" className={inputCls} value={details.startDate} min={TOMORROW_ISO} onChange={(event) => setDetails({ ...details, startDate: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="stime" className="mb-1 block text-[12px] font-medium text-foreground">Start time</label>
                    <input id="stime" type="time" className={inputCls} value={details.startTime} onChange={(event) => setDetails({ ...details, startTime: event.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="stimezone" className="mb-1 block text-[12px] font-medium text-foreground">Timezone</label>
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
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><Users className="h-4 w-4 text-primary" /> Choose your leads</h2>
                <p className={cn(hintCls, 'mt-0.5')}>Every list keeps its own columns. Suppressed addresses are removed automatically.</p>
              </div>
              <Link href="/app/lead-lists#new" className="text-[12px] font-medium text-accent-foreground hover:underline">Add lead list</Link>
            </div>
            {listsError && <p role="alert" className="text-[13px] text-destructive">{listsError}</p>}
            {leadLists === null ? (
              <div className="flex items-center gap-3 rounded-[12px] border border-border px-4 py-6 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your lead lists…</div>
            ) : leadLists.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">No lead lists yet. <Link href="/app/lead-lists#new" className="font-medium text-accent-foreground hover:underline">Add a lead list</Link> to continue.</p>
            ) : (
              <div>
                <label htmlFor="cllist" className={labelCls}>Lead list</label>
                <select id="cllist" className={inputCls} value={selectedListId} onChange={(event) => handleSelectList(event.target.value)}>
                  <option value="">Choose a list…</option>
                  {leadLists.filter((list) => list.leadCount > 0).map((list) => (
                    <option key={list.id} value={list.id}>{list.name}  |  {list.leadCount} leads  |  added {new Date(list.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedListId && (
              previewLoading || !preview ? (
                <div className="flex items-center gap-3 rounded-[12px] border border-border px-4 py-6 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking the suppression list and eligibility…</div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-x-8 gap-y-3 rounded-[12px] border border-border bg-muted/50 p-4 text-[12px]">
                    <div><span className="text-muted-foreground">Total leads</span><br /><span className="text-[18px] font-semibold tabular-nums text-foreground">{preview.leadCount}</span></div>
                    <div><span className="text-muted-foreground">Valid to email</span><br /><span className="text-[18px] font-semibold tabular-nums text-[var(--cf-success)]">{preview.eligibleCount}</span></div>
                    <div><span className="text-muted-foreground">Suppressed</span><br /><span className="text-[18px] font-semibold tabular-nums text-foreground">{preview.suppressedCount}</span></div>
                    <div><span className="text-muted-foreground">Excluded by you</span><br /><span className="text-[18px] font-semibold tabular-nums text-[var(--cf-warning)]">{excludedCount}</span></div>
                    <div><span className="text-muted-foreground">Will receive</span><br /><span className="text-[18px] font-semibold tabular-nums text-accent-foreground">{recipients}</span></div>
                  </div>
                  <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cf-success)]" /> Unsubscribes, hard bounces, complaints and reply-based opt-outs are always skipped. The suppression list is checked again immediately before every send.</p>
                  <div className="overflow-hidden rounded-[12px] border border-border">
                    <div className="flex flex-col justify-between gap-3 border-b border-border p-3 sm:flex-row sm:items-center">
                      <p className="text-[13px] font-semibold text-foreground">Recipient preview <span className="font-normal text-muted-foreground">(first {preview.preview.length})</span></p>
                      <div className="relative sm:w-64">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input value={previewQuery} onChange={(event) => setPreviewQuery(event.target.value)} placeholder="Filter recipients" aria-label="Filter recipients" className="w-full rounded-[8px] border border-border bg-input py-1.5 pl-8 pr-3 text-[12px] outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15" />
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-[12px]">
                        <thead className="bg-muted/50 text-left text-muted-foreground">
                          <tr><th className="w-8 px-3 py-2"></th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Job title</th></tr>
                        </thead>
                        <tbody>
                          {filteredPreview.map((row) => {
                            const included = !excluded.has(row.id);
                            return (
                              <tr key={row.id} className="border-t border-border hover:bg-muted/40">
                                <td className="px-3 py-2"><input type="checkbox" aria-label={`Include ${row.email}`} checked={included} onChange={(event) => toggleExcluded(row.id, event.target.checked)} className="h-4 w-4 accent-primary" /></td>
                                <td className="px-3 py-2 font-medium text-foreground">{row.email}</td>
                                <td className="px-3 py-2 text-muted-foreground">{[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}</td>
                                <td className="px-3 py-2 text-muted-foreground">{row.company ?? '—'}</td>
                                <td className="px-3 py-2 text-muted-foreground">{row.jobTitle ?? '—'}</td>
                              </tr>
                            );
                          })}
                          {filteredPreview.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No recipients match this filter.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    {preview.note && <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">{preview.note}</p>}
                  </div>
                </>
              )
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><FileText className="h-4 w-4 text-primary" /> Choose a template</h2>
                <p className={cn(hintCls, 'mt-0.5')}>This is the email your recipients will receive.</p>
              </div>
              <div className="inline-flex gap-1 rounded-[10px] border border-border bg-muted p-1" role="tablist" aria-label="Template type">
                {([['single', 'Single email'], ['group', 'Variants']] as const).map(([kind, label]) => (
                  <button key={kind} role="tab" aria-selected={templateKind === kind} onClick={() => { setTemplateKind(kind); setSelectedTemplateId(''); }}
                    className={cn('rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors', templateKind === kind ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {shownTemplates.length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground">
                No {templateKind === 'single' ? 'single' : 'group'} templates yet. <Link href="/app/templates" className="font-medium text-accent-foreground hover:underline">Create one</Link> to continue.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {shownTemplates.map((template) => {
                  const active = selectedTemplateId === template.id;
                  return (
                    <li key={template.id}>
                      <button type="button" onClick={() => setSelectedTemplateId(template.id)} aria-pressed={active}
                        className={cn('w-full rounded-[12px] border p-4 text-left transition-[border-color,box-shadow]', active ? 'border-primary bg-primary/[0.04] shadow-[var(--shadow-raised-sm)]' : 'border-border bg-card hover:border-primary/50')}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            {template.mode === 'group' ? <Layers className="h-4 w-4 shrink-0 text-primary" /> : <FileText className="h-4 w-4 shrink-0 text-primary" />}
                            <span className="truncate text-[13px] font-semibold text-foreground">{template.name}</span>
                          </div>
                          {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        </div>
                        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">{template.subject}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>Updated {template.updatedAt}</span>
                          {template.mode === 'group' && <span>{template.variants.length} variants</span>}
                          {template.aiReviewed && <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-[var(--cf-success)]" /> AI reviewed</span>}
                          {template.aiPersonalization && <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3 text-primary" /> AI personalized</span>}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedTemplate && (
              <div className="rounded-[12px] border border-border bg-muted/40 p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Preview</p>
                <p className="text-[13px] font-semibold text-foreground">{selectedTemplate.subject}</p>
                <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{selectedTemplate.body}</p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="max-w-2xl space-y-5">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><Clock className="h-4 w-4 text-primary" /> Set the sending pace</h2>
              <p className={cn(hintCls, 'mt-0.5')}>These defaults protect your domain. You can change them for future campaigns.</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 rounded-[12px] border border-border bg-muted/50 p-4 text-[12px]">
              <div><dt className="text-muted-foreground">Mailbox</dt><dd className="mt-0.5 break-all font-medium text-foreground">{selectedMailbox?.email}</dd></div>
              <div><dt className="text-muted-foreground">Template</dt><dd className="mt-0.5 font-medium text-foreground">{selectedTemplate?.name}</dd></div>
              <div><dt className="text-muted-foreground">Recipients</dt><dd className="mt-0.5 font-medium tabular-nums text-foreground">{recipients}</dd></div>
              <div><dt className="text-muted-foreground">Starts</dt><dd className="mt-0.5 font-medium text-foreground">{details.mode === 'now' ? 'When you confirm' : scheduledAt ? scheduledAt.toLocaleString() : 'Pick a time'}</dd></div>
            </dl>

            <fieldset>
              <legend className={labelCls}>Pause between emails</legend>
              <p className={cn(hintCls, 'mb-2')}>A random pause from this range is applied between sends. This spreads load and avoids sudden bursts; it does not bypass provider filters.</p>
              <select aria-label="Sending interval" className={inputCls} value={intervalPreset} onChange={(event) => setIntervalPreset(event.target.value as IntervalPreset)}>
                {intervalPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}{'recommended' in preset && preset.recommended ? ' (recommended)' : ''}</option>
                ))}
              </select>
              <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" /> Mailbox and provider daily limits are enforced as well. If your provider requires longer pauses, the engine respects them.</p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="daily-cap" className={labelCls}>Max emails per day</label>
                <input id="daily-cap" type="number" min={1} max={2000} className={inputCls} value={dailyCap} onChange={(event) => setDailyCap(Math.max(1, Math.min(2000, Number(event.target.value) || 1)))} />
                {selectedMailbox && <p className={cn(hintCls, 'mt-1.5')}>Mailbox used today: {selectedMailbox.sentToday}/{selectedMailbox.dailyLimit}.</p>}
              </div>
              <label className="flex cursor-pointer select-none flex-col justify-center gap-1.5 rounded-[12px] border border-border bg-card p-4">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={stopOnReply} onChange={(event) => setStopOnReply(event.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
                  <span className="text-[13px] font-medium text-foreground">Stop on reply</span>
                </span>
                <span className={hintCls}>Recipients who reply are never emailed again by this campaign.</span>
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Review and launch</h2>
              <p className={cn(hintCls, 'mt-0.5')}>Check everything below. Nothing is sent until you press the launch button.</p>
            </div>
            <dl className="grid gap-x-8 gap-y-3 text-[13px] sm:grid-cols-2">
              {[
                ['Campaign name', details.name.trim() || '—'],
                ['Sending mailbox', selectedMailbox?.email ?? '—'],
                ['Sending mode', details.mode === 'now' ? 'Starts when you confirm' : `Scheduled for ${scheduledAt?.toLocaleString() ?? '—'} (${details.timezone})`],
                ['Lead list', leadLists?.find((l) => l.id === selectedListId)?.name ?? '—'],
                ['Total leads', String(preview?.leadCount ?? '—')],
                ['Valid recipients', String(eligibleTotal)],
                ['Excluded recipients', String(excludedCount)],
                ['Template type', templateKind === 'group' ? 'Variants (rotating)' : 'Single email'],
                ['Template', selectedTemplate?.name ?? '—'],
                ['Variants', selectedTemplate?.mode === 'group' ? String(selectedTemplate.variants.length) : '1'],
                ['AI personalization', selectedTemplate?.aiPersonalization ? 'Enabled' : 'Disabled'],
                ['Stop on reply', stopOnReply ? 'Yes' : 'No'],
                ['Pause between emails', intervalPresets.find((p) => p.id === intervalPreset)?.label ?? '30-70 seconds'],
                ['Max per day', String(dailyCap)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col border-b border-border pb-2">
                  <dt className="text-[11px] uppercase tracking-[0.05em] text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-[12px] border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[13px] font-semibold text-foreground">Personalized samples <span className="font-normal text-muted-foreground">(real lead data)</span></p>
                <button type="button" onClick={() => void loadSamples()} disabled={sampleBusy} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50">{sampleBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Refresh</button>
              </div>
              {samples.length === 0 ? (
                <p className="text-[13px] leading-relaxed text-muted-foreground">{sampleBusy ? 'Generating samples…' : 'No samples yet. With AI personalization on, each sample takes a few seconds.'}</p>
              ) : (
                <ul className="grid gap-3">
                  {samples.map((sample) => (
                    <li key={sample.lead_id} className="rounded-[10px] border border-border bg-muted/40 p-3">
                      <p className="text-[12px] font-medium text-muted-foreground">{sample.email}{sample.ai ? ' · AI personalized' : ''}</p>
                      <p className="mt-1 text-[13px] font-semibold text-foreground">{sample.subject}</p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">{sample.body}</p>
                      {sample.notes.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">{sample.notes.join(' · ')}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Unsubscribed and bounced addresses can never receive campaign email, even if they are in this list.</p>
            {issues.some((issue) => issue.level === 'error') && (
              <ul className="space-y-1 rounded-[12px] border border-destructive/40 bg-destructive/5 p-4 text-[13px] text-destructive">
                {issues.filter((issue) => issue.level === 'error').map((issue) => <li key={issue.message} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{issue.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {error && <p role="alert" className="mt-4 flex items-center gap-2 rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</p>}

      <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-border pt-5 sm:flex-row">
        <button type="button" onClick={prev} disabled={step === 0 || busy} className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-0">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          <p className="mr-2 hidden text-[12px] text-muted-foreground sm:block">Step {step + 1} of {steps.length}</p>
          {step < steps.length - 1 && (
            <button type="button" onClick={next} disabled={busy} className={primaryBtn}>
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {step === steps.length - 1 && (
            <>
              <button type="button" onClick={() => void createAndLaunch('draft')} disabled={busy || issues.some((issue) => issue.level === 'error')}
                className={secondaryBtn}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save as draft
              </button>
              <button type="button" onClick={() => (details.mode === 'now' ? setConfirmLaunch(true) : void createAndLaunch('schedule'))} disabled={busy || issues.some((issue) => issue.level === 'error')}
                className={primaryBtn}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : details.mode === 'now' ? <Zap className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                {busy ? 'Creating…' : details.mode === 'now' ? 'Launch campaign' : 'Schedule campaign'}
              </button>
            </>
          )}
        </div>
      </div>

      {confirmLaunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0b1220]/50 backdrop-blur-[2px]" onClick={() => setConfirmLaunch(false)} aria-hidden="true" />
          <div role="alertdialog" aria-modal="true" aria-labelledby="launch-confirm-title" className="relative w-full max-w-md rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-raised-lg)]">
            <h2 id="launch-confirm-title" className="mb-2 flex items-center gap-2 text-[17px] font-semibold text-foreground"><Zap className="h-5 w-5 text-primary" /> Start sending now?</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              &quot;{details.name.trim()}&quot; will begin sending to <span className="font-medium text-foreground">{recipients} recipients</span> through {selectedMailbox?.email}. Each send uses your chosen pause and the mailbox daily limit. You can pause at any time.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmLaunch(false)} className={secondaryBtn}>Back</button>
              <button type="button" onClick={() => void createAndLaunch('now')} disabled={busy} className={primaryBtn}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />} Launch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
