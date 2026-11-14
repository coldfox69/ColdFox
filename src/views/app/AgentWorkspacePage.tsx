'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Loader2, Mail, Play, Sparkles, TriangleAlert } from 'lucide-react';
import { AgentIcon } from '@/components/agents/AgentIcon';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { cn } from '@/lib/utils';
import { emptyInputs } from '@/lib/agents/inputs';
import { COMMON_TIMEZONES } from '@/lib/timezone';
import type { AgentDetail, AgentFieldDefinition } from '@/lib/agents/types';

/** The zone `<input type="datetime-local">` is interpreted in by the browser. */
const SCHEDULE_TIMEZONE =
  typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC';

interface RunRow {
  id: string;
  status: string;
  createdAt: string;
  finishedAt: string | null;
  scheduledFor: string | null;
  leadListId: string | null;
  campaignId: string | null;
  error: string | null;
}

interface MailboxOption {
  id: string;
  email_address: string;
  display_name: string | null;
  status: string;
}

interface TemplateOption {
  id: string;
  name: string;
  subject: string | null;
  mode: string | null;
}

const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60';
const labelCls = 'block text-[13px] font-medium text-foreground';

const RUN_LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Finished',
  awaiting_api: 'Waiting for API setup',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function statusTone(status: string) {
  if (status === 'succeeded') return 'text-[var(--cf-success)]';
  if (status === 'failed') return 'text-destructive';
  if (status === 'awaiting_api') return 'text-[var(--cf-warning)]';
  return 'text-muted-foreground';
}

export default function AgentWorkspacePage({
  slug,
  source = 'manual',
  automationId = null,
  initialAgent = null,
  initialRuns = [],
}: {
  slug: string;
  source?: 'manual' | 'automation';
  automationId?: string | null;
  initialAgent?: AgentDetail | null;
  initialRuns?: RunRow[];
}) {
  const toast = useToast();
  const [agent, setAgent] = useState<AgentDetail | null>(initialAgent);
  const [runs, setRuns] = useState<RunRow[]>(initialRuns);
  const [loading, setLoading] = useState(!initialAgent);
  const [busy, setBusy] = useState(false);

  const [inputs, setInputs] = useState<Record<string, unknown>>(() => emptyInputs(initialAgent?.fields ?? []));
  const [mailboxes, setMailboxes] = useState<MailboxOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);

  const [outreachEnabled, setOutreachEnabled] = useState(true);
  const [mailboxId, setMailboxId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [sendWindowStart, setSendWindowStart] = useState('09:00');
  const [sendWindowEnd, setSendWindowEnd] = useState('17:00');
  const [dailyLimit, setDailyLimit] = useState(100);
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [sendAt, setSendAt] = useState('');
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ agent: AgentDetail; runs: RunRow[] }>(`/api/agents/${slug}`);
      setAgent(data.agent);
      setRuns(data.runs ?? []);
      setInputs((current) => (Object.keys(current).length ? current : emptyInputs(data.agent.fields ?? [])));
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setLoading(false);
    }
  }, [slug, toast]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ agent: AgentDetail; runs: RunRow[] }>(`/api/agents/${slug}`)
      .then((data) => {
        if (cancelled) return;
        setAgent(data.agent);
        setRuns(data.runs ?? []);
        setInputs((current) => (Object.keys(current).length ? current : emptyInputs(data.agent.fields ?? [])));
      })
      .catch((error) => {
        if (!cancelled) toast.show(errorMessage(error), 'danger');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, toast]);

  useEffect(() => {
    // The dropdowns of the outreach step need the connected accounts and the
    // templates of this workspace.
    Promise.all([
      apiFetch<{ mailboxes: MailboxOption[] }>('/api/mailboxes'),
      apiFetch<TemplateOption[]>('/api/templates'),
    ])
      .then(([mailboxData, templateData]) => {
        setMailboxes((mailboxData.mailboxes ?? []).filter((mailbox) => mailbox.status === 'connected'));
        setTemplates(templateData ?? []);
      })
      .catch(() => undefined);
  }, []);

  const fields: AgentFieldDefinition[] = useMemo(() => agent?.fields ?? [], [agent]);

  const setField = (key: string, value: unknown) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  const start = async () => {
    if (!agent) return;
    const missing = fields.filter(field => field.required && !String(inputs[field.key] ?? '').trim());
    if (missing.length > 0) {
      toast.show(`Fill in ${missing.map(field => field.label).join(', ')} before starting.`, 'danger');
      return;
    }
    if (mode === 'schedule' && !sendAt) {
      toast.show('Pick a date and time to schedule the task.', 'danger');
      return;
    }
    if (agent.supportsOutreach && outreachEnabled && !mailboxId) {
      toast.show('Choose a sending mailbox, or turn email outreach off.', 'danger');
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch<{ id: string }>(`/api/agents/${agent.slug}/run`, {
        method: 'POST',
        body: JSON.stringify({
          inputs,
          mode,
          send_at: mode === 'schedule' && sendAt ? new Date(sendAt).toISOString() : undefined,
          source,
          automation_id: source === 'automation' ? automationId : null,
          outreach: agent.supportsOutreach
            ? {
              enabled: outreachEnabled,
              mailbox_id: mailboxId || null,
              template_id: templateId || null,
              campaign_name: campaignName || undefined,
              subject: subject || undefined,
              body: body || undefined,
              timezone,
              daily_limit: dailyLimit,
              send_window_start: sendWindowStart,
              send_window_end: sendWindowEnd,
            }
            : undefined,
        }),
        dedupe: false,
      });
      setActiveRunId(response.id);
      toast.show(mode === 'schedule' ? 'Task scheduled.' : 'Task started.', 'success');
      void load();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  // Follow the task while it runs.
  useEffect(() => {
    if (!activeRunId) return;
    let cancelled = false;
    const tick = () => {
      apiFetch<{ run: { status: string; error: string | null } }>(`/api/agents/runs/${activeRunId}`)
        .then((data) => {
          if (cancelled) return;
          if (['succeeded', 'failed', 'awaiting_api', 'cancelled'].includes(data.run.status)) {
            setActiveRunId(null);
            void load();
          }
        })
        .catch(() => {
          // A transient error should not stop the poll.
        });
    };
    tick();
    const timer = setInterval(tick, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [activeRunId, load]);

  if (loading) {
    return <div className="px-6 py-8 text-[13px] text-muted-foreground">Loading the agent…</div>;
  }
  if (!agent) {
    return (
      <div className="px-6 py-8 space-y-3">
        <p className="text-[13px] text-muted-foreground">This agent is not available.</p>
        <Link href="/app/agents" className="inline-flex items-center gap-2 text-[13px] text-foreground hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to agents
        </Link>
      </div>
    );
  }

  const connectedMailboxes = mailboxes;
  const selectedTemplate = templates.find((template) => template.id === templateId);
  const needsMessage = !templateId;

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto space-y-6">
      <div>
        <Link href="/app/agents" className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> AI agents
        </Link>
        <div className="mt-3 flex items-start gap-3">
          <span className="icon-tile-ai h-11 w-11 shrink-0 rounded-[10px]">
            <AgentIcon name={agent.icon} className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-[22px] font-semibold text-foreground">{agent.name}</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">{agent.category}</p>
          </div>
        </div>
        <p className="text-[13px] text-muted-foreground mt-3 max-w-3xl">{agent.description}</p>
        {agent.purpose ? (
          <p className="text-[13px] text-muted-foreground mt-1 max-w-3xl flex gap-2">
            <Sparkles className="w-4 h-4 shrink-0 mt-0.5" /> {agent.purpose}
          </p>
        ) : null}
        {!agent.apiConfigured ? (
          <p className="mt-3 inline-flex items-start gap-2 rounded-[10px] bg-muted px-3 py-2 text-[12px] text-muted-foreground max-w-2xl">
            <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
            This agent is not connected to its API yet. You can still fill in the form and save the task, but the task stops until an administrator connects the API.
          </p>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <section className="neu-card space-y-4 rounded-[16px] p-5">
            <div className="flex items-start gap-3">
              <span className="icon-tile h-7 w-7 shrink-0 rounded-full text-[12px] font-semibold">1</span>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">What this agent needs</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Fill in these details so the agent has what it needs to do its work.</p>
              </div>
            </div>

            {fields.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">This agent does not ask for any information.</p>
            ) : (
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className={labelCls} htmlFor={`field-${field.key}`}>
                      {field.label}
                      {field.required ? <span className="text-destructive ml-1">*</span> : null}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={`field-${field.key}`}
                        rows={4}
                        value={String(inputs[field.key] ?? '')}
                        onChange={(event) => setField(field.key, event.target.value)}
                        placeholder={field.placeholder}
                        className={cn(inputCls, 'mt-1.5')}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        id={`field-${field.key}`}
                        value={String(inputs[field.key] ?? '')}
                        onChange={(event) => setField(field.key, event.target.value)}
                        className={cn(inputCls, 'mt-1.5')}
                      >
                        <option value="">Select {field.label.toLowerCase()}</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : field.type === 'multiselect' ? (
                      <select
                        id={`field-${field.key}`}
                        multiple
                        value={Array.isArray(inputs[field.key]) ? (inputs[field.key] as string[]) : []}
                        onChange={(event) => setField(field.key, Array.from(event.target.selectedOptions).map((option) => option.value))}
                        className={cn(inputCls, 'mt-1.5 h-auto min-h-[96px] py-2')}
                      >
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    ) : field.type === 'boolean' ? (
                      <label className="mt-1.5 inline-flex items-center gap-2 text-[13px] text-foreground">
                        <input
                          type="checkbox"
                          checked={Boolean(inputs[field.key])}
                          onChange={(event) => setField(field.key, event.target.checked)}
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                        {field.placeholder ?? 'Yes'}
                      </label>
                    ) : (
                      <input
                        id={`field-${field.key}`}
                        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'}
                        value={String(inputs[field.key] ?? '')}
                        onChange={(event) => setField(field.key, event.target.value)}
                        placeholder={field.placeholder}
                        min={field.min}
                        max={field.max}
                        className={cn(inputCls, 'mt-1.5')}
                      />
                    )}
                    {field.help ? <p className="mt-1 text-[11px] text-muted-foreground">{field.help}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {agent.supportsOutreach ? (
            <section className="neu-card space-y-4 rounded-[16px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="icon-tile h-7 w-7 shrink-0 rounded-full text-[12px] font-semibold">2</span>
                  <div>
                    <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                      <Mail className="h-4 w-4" /> Email outreach
                    </h2>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      The leads the agent finds go into a lead list, then this campaign sends to them.
                    </p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={outreachEnabled}
                    onChange={(event) => setOutreachEnabled(event.target.checked)}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Send emails
                </label>
              </div>

              {outreachEnabled ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls} htmlFor="outreach-mailbox">Sending account</label>
                      <select
                        id="outreach-mailbox"
                        value={mailboxId}
                        onChange={(event) => setMailboxId(event.target.value)}
                        className={cn(inputCls, 'mt-1.5')}
                      >
                        <option value="">Choose a mailbox</option>
                        {connectedMailboxes.map((mailbox) => (
                          <option key={mailbox.id} value={mailbox.id}>
                            {mailbox.display_name ? `${mailbox.display_name} · ` : ''}{mailbox.email_address}
                          </option>
                        ))}
                      </select>
                      {connectedMailboxes.length === 0 ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">No connected mailbox yet. Connect one under Mailboxes.</p>
                      ) : null}
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="outreach-template">Template</label>
                      <select
                        id="outreach-template"
                        value={templateId}
                        onChange={(event) => setTemplateId(event.target.value)}
                        className={cn(inputCls, 'mt-1.5')}
                      >
                        <option value="">Write the message here</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>{template.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls} htmlFor="outreach-campaign">Campaign name</label>
                      <input
                        id="outreach-campaign"
                        value={campaignName}
                        onChange={(event) => setCampaignName(event.target.value)}
                        placeholder={campaignName ? '' : `${agent.name} outreach`}
                        className={cn(inputCls, 'mt-1.5')}
                      />
                    </div>
                  </div>

                  {needsMessage ? (
                    <div className="space-y-3">
                      <div>
                        <label className={labelCls} htmlFor="outreach-subject">Subject</label>
                        <input
                          id="outreach-subject"
                          value={subject}
                          onChange={(event) => setSubject(event.target.value)}
                          className={cn(inputCls, 'mt-1.5')}
                        />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="outreach-body">Message</label>
                        <textarea
                          id="outreach-body"
                          rows={6}
                          value={body}
                          onChange={(event) => setBody(event.target.value)}
                          className={cn(inputCls, 'mt-1.5')}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">
                      The template “{selectedTemplate?.name}” is used. Placeholders must exist in the generated lead list.
                    </p>
                  )}

                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <label className={labelCls} htmlFor="outreach-window-start">Send window starts</label>
                      <input id="outreach-window-start" type="time" value={sendWindowStart} onChange={(event) => setSendWindowStart(event.target.value)} className={cn(inputCls, 'mt-1.5')} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="outreach-window-end">Send window ends</label>
                      <input id="outreach-window-end" type="time" value={sendWindowEnd} onChange={(event) => setSendWindowEnd(event.target.value)} className={cn(inputCls, 'mt-1.5')} />
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="outreach-timezone">Timezone</label>
                      <select id="outreach-timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} className={cn(inputCls, 'mt-1.5')}>
                        {COMMON_TIMEZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="outreach-limit">Daily limit</label>
                      <input id="outreach-limit" type="number" min={1} max={2000} value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} className={cn(inputCls, 'mt-1.5')} />
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="neu-card space-y-4 rounded-[16px] p-5">
            <div className="flex items-start gap-3">
              <span className="icon-tile h-7 w-7 shrink-0 rounded-full text-[12px] font-semibold">3</span>
              <div>
                <h2 className="text-[15px] font-semibold text-foreground">When should it run</h2>
                <p className="mt-0.5 text-[12px] text-muted-foreground">Run it now, or schedule the task for later. Scheduled tasks run in the background.</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('now')}
                className={cn(
                  'text-left rounded-[12px] border p-4 transition-[color,background-color,border-color] duration-[var(--dur)] ease-[var(--ease)]',
                  mode === 'now' ? 'border-primary bg-[var(--brand-soft)]' : 'border-border hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <Play className="w-4 h-4" /> Run immediately
                </span>
                <span className="mt-1 block text-[12px] text-muted-foreground">The agent starts as soon as you confirm.</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('schedule')}
                className={cn(
                  'text-left rounded-[12px] border p-4 transition-[color,background-color,border-color] duration-[var(--dur)] ease-[var(--ease)]',
                  mode === 'schedule' ? 'border-primary bg-[var(--brand-soft)]' : 'border-border hover:bg-muted',
                )}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  <Clock className="w-4 h-4" /> Schedule for later
                </span>
                <span className="mt-1 block text-[12px] text-muted-foreground">The task starts at the date and time you pick.</span>
              </button>
            </div>
            {mode === 'schedule' ? (
              <div className="max-w-xs">
                <label className={labelCls} htmlFor="send-at">Date and time</label>
                <input
                  id="send-at"
                  type="datetime-local"
                  value={sendAt}
                  onChange={(event) => setSendAt(event.target.value)}
                  className={cn(inputCls, 'mt-1.5')}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Uses your browser&apos;s local time ({SCHEDULE_TIMEZONE}).</p>
              </div>
            ) : null}

            <div className="rounded-[10px] border border-border bg-muted/60 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
              {mode === 'schedule'
                ? `The task starts on ${sendAt ? new Date(sendAt).toLocaleString() : 'the date you choose'}${agent.supportsOutreach && outreachEnabled ? ', then creates an outreach campaign.' : '.'}`
                : agent.supportsOutreach && outreachEnabled
                  ? 'Starting now runs the agent and creates an outreach campaign using the settings above.'
                  : 'Starting now runs the agent in the background. You can follow progress in Recent tasks.'}
            </div>

            <button
              type="button"
              onClick={() => void start()}
              disabled={busy || Boolean(activeRunId)}
              className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-60"
            >
              {busy || activeRunId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {activeRunId ? 'Running…' : mode === 'schedule' ? 'Schedule task' : 'Start agent'}
            </button>
          </section>
        </div>

        <div className="space-y-5">
          <section className="neu-card rounded-[16px] p-5">
            <h2 className="text-[15px] font-semibold text-foreground">Recent tasks</h2>
            {runs.length === 0 ? (
              <div className="mt-3 rounded-[10px] border border-dashed border-border px-3 py-6 text-center">
                <Clock className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-2 text-[13px] font-medium text-foreground">No tasks yet</p>
                <p className="mt-1 text-[12px] text-muted-foreground">Start the agent and its progress appears here.</p>
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {runs.map((run) => (
                  <li key={run.id} className="rounded-[10px] border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('flex items-center gap-1.5 text-[12px] font-medium', statusTone(run.status))}>
                        {run.status === 'succeeded' ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                        {RUN_LABELS[run.status] ?? run.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {run.scheduledFor ? `for ${new Date(run.scheduledFor).toLocaleString()}` : new Date(run.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {run.error ? <p className="mt-1.5 text-[12px] text-destructive">{run.error}</p> : null}
                    {run.campaignId ? (
                      <Link href={`/app/campaigns/${run.campaignId}`} className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-foreground hover:underline">
                        Open campaign <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
