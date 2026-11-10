'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadImportStep, type ImportResult } from '@/components/campaign/LeadImportStep';
import { EmailComposeStep, type EmailDraft } from '@/components/campaign/EmailComposeStep';
import { SendingSettingsStep, defaultSending, validateSending, type SendingSettings } from '@/components/campaign/SendingSettingsStep';
import { CampaignReview } from '@/components/campaign/CampaignReview';
import { ValidationList } from '@/components/campaign/SendingSettingsStep';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/components/shared/ToastProvider';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { type CampaignVM, type MailboxVM, type TemplateVM } from '@/lib/view-models';

const steps = ['Details', 'Leads', 'Email', 'Sending', 'Review'];
const objectives = [
  'Book meetings',
  'Generate replies',
  'Start trials',
  'Recruit candidates',
  'Partner outreach',
];

const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

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
  const [details, setDetails] = useState({ name: '', description: '', objective: '' });
  const [rows, setRows] = useState<{ firstName: string; lastName: string; email: string; company: string; jobTitle: string; website: string; industry: string }[]>([]);
  const [draft, setDraft] = useState<EmailDraft>({
    templateName: '',
    subject: 'Quick question about {{company}}',
    previewText: '',
    body: 'Hi {{first_name}},\n\n',
    sender: '',
  });
  const [sending, setSending] = useState<SendingSettings>(defaultSending);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [launched, setLaunched] = useState<string | null>(null);
  const [templateSelection, setTemplateSelection] = useState<string>('');

  const validLeads = rows.filter((row) => /^\S+@\S+\.\S+$/.test(row.email) && row.firstName && row.company).length;
  const issues = useMemo(() => {
    return validateSending(sending, validLeads, initialMailboxes);
  }, [sending, validLeads, initialMailboxes]);

  const detected = useMemo(() => {
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const map: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', company: 'company', jobTitle: 'job_title', website: 'website', industry: 'industry' };
    return columns.filter((column) => column in map).map((column) => map[column]);
  }, [rows]);

  const next = () => {
    if (step === 0 && !details.name.trim()) return setError('Give your campaign a name to continue.');
    if (step === 1 && validLeads === 0) return setError('Import at least one valid lead to continue.');
    if (step === 2 && (!draft.subject.trim() || !draft.body.trim())) return setError('A subject and email body are required.');
    if (step === 3 && issues.some((issue) => issue.level === 'error')) return setError('Resolve the highlighted errors before reviewing.');
    setError('');
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const prev = () => {
    setError('');
    setStep((current) => Math.max(0, current - 1));
  };

  const createCampaign = async () => {
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: details.name.trim(),
        description: details.description.trim() || null,
        template_id: templateSelection || null,
        timezone: sending.timezone,
        daily_limit: sending.dailyCap,
        lead_ids: [],
        send_window_start: sending.windowStart,
        send_window_end: sending.windowEnd,
        weekdays: sending.weekdays,
        stop_on_reply: sending.pauseOnReply,
        follow_up_days: sending.followUpDays > 0 ? sending.followUpDays : 0,
        subject: draft.subject.trim() || undefined,
        body: draft.body.trim() || undefined,
      };

      if (sending.mailboxId) body.mailbox_id = sending.mailboxId;

      const campaign = await apiFetch<CampaignVM>('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const scheduled = sending.mode === 'schedule'
        ? new Date(`${sending.startDate}T${sending.startTime}:00`).toISOString()
        : undefined;

      await apiFetch<{ status: string; queued: number }>(
        `/api/campaigns/${campaign.id}/launch`,
        { method: 'POST', body: JSON.stringify({ mode: scheduled ? 'schedule' : 'now', send_at: scheduled }) },
      );

      setLaunched(sending.mode);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (launched) {
    return (
      <div className="p-6 lg:p-10 max-w-xl mx-auto text-center">
        <div className="neu-card rounded-[20px] p-10 mt-10">
          <div className="w-16 h-16 rounded-[16px] neu-inset-sm flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-[var(--cf-success)]" />
          </div>
          <h1 className="text-[20px] font-semibold text-foreground mb-2">
            {launched === 'now' ? 'Campaign launched' : 'Campaign scheduled'}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {launched === 'now'
              ? `"${details.name}" is now sending. Replies will appear in your Unified Inbox.`
              : `"${details.name}" will start on ${sending.startDate} at ${sending.startTime}.`}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => router.push('/app/campaigns')} className="px-5 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">View campaigns</button>
            <button onClick={() => router.push('/app/inbox')} className="px-5 py-2.5 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">Open inbox</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto">
      <Link href="/app/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 block"><ArrowLeft className="w-4 h-4" /> Back to campaigns</Link>
      <PageHeader title="New campaign" description="Import leads, write your message, and schedule the send." />

      <ol className="flex items-center gap-2 mb-8 overflow-x-auto pb-1" aria-label="Campaign steps">
        {steps.map((label, index) => (
          <li key={label} className="flex items-center gap-2 flex-shrink-0">
            <button type="button" disabled={index > step} onClick={() => setStep(index)} aria-current={index === step ? 'step' : undefined}
              className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:cursor-default',
                index === step ? 'rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50' : index < step ? 'neu-inset-sm text-muted-foreground' : 'bg-muted text-muted-foreground')}>
              {index < step ? <Check className="w-3.5 h-3.5" /> : <span>{index + 1}</span>} {label}
            </button>
            {index < steps.length - 1 && <span className="w-6 h-px bg-border" />}
          </li>
        ))}
      </ol>

      <div className="neu-card rounded-[20px] p-6 sm:p-8">
        {step === 0 && (
          <div className="grid gap-5 max-w-2xl">
            <div>
              <label htmlFor="cname" className="text-sm font-medium mb-1.5 block">Campaign name</label>
              <input id="cname" className={inputCls} value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })} placeholder="Q1 SaaS founders outreach" />
            </div>
            <div>
              <label htmlFor="cdesc" className="text-sm font-medium mb-1.5 block">Description</label>
              <textarea id="cdesc" rows={3} className={inputCls} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} placeholder="Who this campaign targets and why" />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Objective</p>
              <div className="flex flex-wrap gap-2">
                {objectives.map((objective) => (
                  <button key={objective} type="button" aria-pressed={details.objective === objective} onClick={() => setDetails({ ...details, objective })}
                    className={cn('px-3.5 py-2 rounded-xl text-sm border transition-colors', details.objective === objective ? 'neu-inset-sm text-accent-foreground' : 'border-border hover:bg-muted')}>{objective}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-4">
            <LeadImportStep onComplete={async (result: ImportResult) => {
              const map: Record<string, string> = { first_name: 'firstName', last_name: 'lastName', email: 'email', company: 'company', job_title: 'jobTitle', website: 'website', industry: 'industry' };
              // Imported leads are already in the CRM; show a confirmation and let the user select them.
              toast.show(`Imported ${result.created} new leads (${result.duplicates} duplicates skipped). Select them from the Leads page before launching.`, 'success');
              router.push('/app/leads');
            }} />
          </div>
        )}
        {step === 2 && (
          <EmailComposeStep
            draft={draft}
            onChange={setDraft}
            detected={detected}
            templates={initialTemplates}
            onSaveTemplate={() => {
              toast.show('Template saving is handled from the Templates page.', 'info');
            }}
          />
        )}
        {step === 3 && (
          <div className="space-y-6">
            <SendingSettingsStep value={sending} onChange={setSending} mailboxes={initialMailboxes} />
            <ValidationList issues={issues} />
          </div>
        )}
        {step === 4 && (
          <div className="space-y-6">
            <CampaignReview
              summary={{ name: details.name, objective: details.objective, leadCount: validLeads, subject: draft.subject, sending }}
              issues={issues}
              mailboxes={initialMailboxes}
            />
            {initialTemplates.length > 0 && (
              <div className="neu-card rounded-[16px] p-4">
                <label className="text-[12px] font-medium text-muted-foreground mb-2 block">Choose a saved template instead</label>
                <select value={templateSelection} onChange={(event) => setTemplateSelection(event.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60">
                  <option value="">Use the message above</option>
                  {initialTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => void createCampaign()} disabled={busy || issues.some((issue) => issue.level === 'error')}
                className="px-6 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed">
                {busy ? 'Creating…' : sending.mode === 'now' ? 'Send now' : 'Schedule campaign'}
              </button>
              <button type="button" onClick={prev} disabled={busy}
                className="px-5 py-2.5 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">Back</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button type="button" onClick={prev} disabled={step === 0 || busy}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {step < steps.length - 1 && (
          <button type="button" onClick={next} disabled={busy}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed">
            Continue <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    </div>
  );
}
