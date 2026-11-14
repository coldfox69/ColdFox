'use client';

import { useMemo, useState } from 'react';
import { Send, Sparkles, Copy, Save, Wand2, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Mail, FileText } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/shared/ToastProvider';
import { cn } from '@/lib/utils';
import { apiFetch, apiStream, errorMessage, extractPartialJsonString } from '@/lib/client/api';

type Tone = 'professional' | 'friendly' | 'direct' | 'consultative' | 'formal';

const promptChips = [
  'Write a cold intro for a SaaS founder',
  'Follow-up after no reply',
  'Partnership pitch for an agency',
  'Short re-engagement email',
];

const spamTerms = ['guarantee', 'act now', 'free money', 'risk-free', 'urgent', 'winner', 'no obligation', '100%'];

const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryBtn = 'inline-flex items-center gap-1.5 rounded-[9px] border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50';

interface AiEmailResult {
  subject: string;
  body: string;
  subjects: string[];
  warnings: string[];
  unsupported_claims: string[];
  suggestions: string[];
  compliance: {
    sender_identity_present: boolean;
    unsubscribe_present: boolean;
    clear_purpose: boolean;
    no_deceptive_subject: boolean;
  };
}

export default function AiWriterPage() {
  const toast = useToast();
  const [messages, setMessages] = useState<{ id: number; role: 'user' | 'assistant'; text: string }[]>([
    { id: 0, role: 'assistant', text: 'Tell me who you are writing to and what you want them to do. I will draft the email and you can refine it.' },
  ]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [tone, setTone] = useState<Tone>('professional');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [optimized, setOptimized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const report = useMemo(() => analyze(subject, body), [subject, body]);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt) return;
    setBusy(true);
    setError('');
    setGenerating(true);
    try {
      setMessages((current) => [
        ...current,
        { id: current.length, role: 'user', text: prompt },
        { id: current.length + 1, role: 'assistant', text: 'Writing a first draft…' },
      ]);

      // Streamed so the draft appears token by token instead of after the
      // whole generation finishes.
      let raw = '';
      let streamedSubject = '';
      let streamedBody = '';
      let final: AiEmailResult | null = null;

      await apiStream<{ type: string; text?: string; data?: AiEmailResult; error?: string }>(
        '/api/ai/email',
        { mode: 'generate', prompt, tone, sender: { name: '' }, stream: true },
        (event) => {
          if (event.type === 'delta' && typeof event.text === 'string') {
            raw += event.text;
            streamedSubject = extractPartialJsonString(raw, 'subject');
            streamedBody = extractPartialJsonString(raw, 'body');
            if (streamedSubject) setSubject(streamedSubject);
            if (streamedBody) setBody(streamedBody);
          } else if (event.type === 'done' && event.data) {
            final = event.data;
          } else if (event.type === 'error') {
            throw new Error(event.error || 'The AI request failed.');
          }
        },
      );

      if (!final) throw new Error('The AI did not return a complete draft. Please retry.');
      const result = final as AiEmailResult;
      setDraft(result);
      setSubject(result.subject);
      setBody(result.body);
      setMessages((current) => [
        ...current,
        { id: current.length, role: 'assistant', text: 'Here is a first draft. Edit it on the right or ask me to rewrite it.' },
      ]);
      setInput('');
      setOptimized(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setGenerating(false);
      setBusy(false);
    }
  };

  const rewrite = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch<AiEmailResult>('/api/ai/email', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'rewrite',
          prompt: body,
          tone,
          subject,
          body,
        }),
      });
      setSubject(result.subject);
      setBody(result.body);
      setOptimized(false);
      toast.show(`Rewritten in a ${tone} tone.`, 'success');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const optimize = async () => {
    if (!subject.trim() && !body.trim()) return;
    setBusy(true);
    setOptimized(false);
    setError('');
    try {
      const result = await apiFetch<AiEmailResult>('/api/ai/email', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'optimize',
          prompt: 'Optimize this outreach email for clarity and honesty.',
          tone,
          subject,
          body,
        }),
      });
      setSubject(result.subject);
      setBody(result.body);
      setOptimized(true);
      toast.show('Optimizer complete. Review the suggestions below.', 'success');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const subjectLines = async () => {
    if (!body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch<AiEmailResult>('/api/ai/email', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'subjects',
          prompt: body,
          tone,
          subject,
          body,
        }),
      });
      const suggestion = result.subjects[0] ?? result.subject;
      setSubject(suggestion);
      setOptimized(false);
      toast.show(`Suggested subject: ${suggestion}`, 'success');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const followUp = async () => {
    if (!subject.trim() && !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiFetch<AiEmailResult>('/api/ai/email', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'follow_up',
          prompt: 'Write a polite follow-up after no reply.',
          tone,
          subject,
          body,
        }),
      });
      setDraft(result);
      setSubject(result.subject);
      setBody(result.body);
      setOptimized(false);
      toast.show('Follow-up draft generated.', 'success');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const text = `Subject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.show('Email copied to clipboard.', 'success');
    } catch {
      toast.show('Copy is not available in this browser.', 'danger');
    }
  };

  const saveTemplate = async () => {
    if (!subject.trim() || !body.trim()) return toast.show('Add a subject and body before saving.', 'danger');
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: subject.slice(0, 80),
          subject,
          body_text: body,
          category: 'Campaign',
        }),
      });
      toast.show(`Saved "${subject}" to your templates.`, 'success');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="AI email writer"
        description="Describe the email you need and get a draft you can edit. Suggestions improve clarity; they cannot guarantee inbox placement or replies."
      />

      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Assistant */}
        <section className="neu-card flex min-h-[460px] flex-col rounded-[16px]" aria-busy={generating}>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-accent text-accent-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-foreground">Writing assistant</h2>
              <p className="text-[11px] text-muted-foreground">Starts from your prompt, not a blank page</p>
            </div>
          </div>
          <div className="max-h-[440px] flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'max-w-[85%] rounded-[14px] px-4 py-2.5 text-[13px] leading-relaxed',
                  message.role === 'user' ? 'ml-auto bg-accent text-accent-foreground' : 'border border-border bg-muted text-foreground',
                )}
              >
                {message.text}
              </div>
            ))}
            {generating && (
              <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing. The draft appears on the right as it is generated.
              </p>
            )}
          </div>
          <div className="space-y-3 border-t border-border p-4">
            <div className="flex flex-wrap gap-2">
              {promptChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => send(chip)}
                  disabled={generating}
                  className="rounded-lg border border-border px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {chip}
                </button>
              ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void send(input); }} className="flex gap-2" noValidate>
              <label htmlFor="ai-prompt" className="sr-only">Describe the email</label>
              <input id="ai-prompt" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe the email you need…" className={inputCls} />
              <button
                type="submit"
                disabled={!input.trim() || generating}
                className="inline-flex shrink-0 items-center gap-2 rounded-[10px] bg-primary px-4 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">Draft</span>
              </button>
            </form>
          </div>
        </section>

        {/* Editor */}
        <section className="min-w-0 space-y-5">
          {!draft ? (
            <div className="neu-card rounded-[16px] p-8">
              <div className="mx-auto max-w-sm text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-accent-foreground">
                  <Mail className="h-5 w-5" />
                </span>
                <h2 className="mt-3 text-[15px] font-semibold text-foreground">Your draft appears here</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Send a prompt on the left, or start from one of the suggestions. You can edit every word before saving.
                </p>
                <ol className="mt-4 space-y-2 text-left text-[12px] text-muted-foreground">
                  <li className="flex gap-2"><span className="font-semibold text-foreground">1.</span> Say who you are writing to and why.</li>
                  <li className="flex gap-2"><span className="font-semibold text-foreground">2.</span> Pick a tone, then refine the draft.</li>
                  <li className="flex gap-2"><span className="font-semibold text-foreground">3.</span> Save it as a template for a campaign.</li>
                </ol>
              </div>
            </div>
          ) : (
            <>
              <div className="neu-card space-y-4 rounded-[16px] p-5">
                <div>
                  <label htmlFor="ai-subject" className="mb-1.5 block text-[13px] font-medium text-foreground">Subject</label>
                  <input id="ai-subject" value={subject} onChange={(event) => { setSubject(event.target.value); setOptimized(false); }} className={inputCls} />
                  <p className="mt-1 text-[11px] text-muted-foreground">{subject.length} characters. Short subjects are easier to scan.</p>
                </div>
                <div>
                  <label htmlFor="ai-body" className="mb-1.5 block text-[13px] font-medium text-foreground">Body</label>
                  <textarea id="ai-body" value={body} onChange={(event) => { setBody(event.target.value); setOptimized(false); }} rows={9} className={cn(inputCls, 'resize-y')} />
                </div>

                <div className="rounded-[10px] border border-border bg-muted/60 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="ai-tone" className="text-[12px] font-medium text-foreground">Tone</label>
                    <select id="ai-tone" value={tone} onChange={(event) => setTone(event.target.value as Tone)} className="rounded-[8px] border border-border bg-card px-2.5 py-1.5 text-[12px] outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/15">
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="direct">Direct</option>
                      <option value="consultative">Consultative</option>
                      <option value="formal">Formal</option>
                    </select>
                    <span className="text-[11px] text-muted-foreground">Then use one of the tools below.</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => void rewrite()} disabled={busy || !body.trim()} className={secondaryBtn}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Rewrite in this tone
                    </button>
                    <button onClick={() => void subjectLines()} disabled={busy || !body.trim()} className={secondaryBtn}>
                      <Sparkles className="h-3.5 w-3.5" /> Suggest subjects
                    </button>
                    <button onClick={() => void followUp()} disabled={busy || (!subject.trim() && !body.trim())} className={secondaryBtn}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Follow-up draft
                    </button>
                    <button onClick={() => void optimize()} disabled={busy || (!subject.trim() && !body.trim())} className={secondaryBtn}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Check and optimize
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                  <button onClick={() => void copy()} className={secondaryBtn} aria-label="Copy email">
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  <button onClick={() => void saveTemplate()} disabled={saving} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-60">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saving ? 'Saving…' : 'Save as template'}
                  </button>
                </div>
              </div>

              {optimized && (
                <div className="neu-card space-y-5 rounded-[16px] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[15px] font-semibold text-foreground">Optimizer report</h2>
                    <span className="text-[12px] text-muted-foreground">Clarity score <strong className="text-foreground">{report.clarity}/100</strong></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.clarity}>
                    <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--dur-slow)] ease-[var(--ease)]" style={{ width: `${report.clarity}%` }} />
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">{report.words} words. Clarity measures length, readability, and a clear question. It does not predict deliverability or replies.</p>

                  <div>
                    <p className="mb-2 text-[13px] font-medium text-foreground">Spam-trigger check</p>
                    {report.spamHits.length === 0 ? (
                      <p className="flex gap-2 text-[13px] text-[var(--cf-success)]"><CheckCircle2 className="h-4 w-4 shrink-0" /> No common spam-trigger phrases found.</p>
                    ) : (
                      <div className="flex gap-2 text-[13px] text-[var(--cf-warning)]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Consider rewording: {report.spamHits.join(', ')}.</div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-[13px] font-medium text-foreground">Compliance checklist</p>
                    <ul className="space-y-2">
                      {report.compliance.map((item) => (
                        <li key={item.label} className="flex items-center gap-2 text-[13px]">
                          {item.ok ? <CheckCircle2 className="h-4 w-4 text-[var(--cf-success)]" /> : <AlertTriangle className="h-4 w-4 text-[var(--cf-warning)]" />}
                          <span className={cn('text-foreground', !item.ok && 'text-muted-foreground')}>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="neu-card rounded-[16px] p-5">
                <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Preview</p>
                <p className="text-[14px] font-semibold text-foreground">{subject || 'No subject'}</p>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{body}</p>
                <p className="mt-3 text-[12px] text-muted-foreground">Variables like {'{{first_name}}'} are filled in per lead when a campaign sends.</p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function analyze(subject: string, body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  const sentences = body.split(/[.!?]+/).filter((s) => s.trim()).length || 1;
  const avgLen = words / sentences;
  let clarity = 100;
  if (words > 150) clarity -= 20;
  if (words < 30) clarity -= 10;
  if (avgLen > 22) clarity -= 15;
  if (!/\?/.test(body)) clarity -= 10;
  if (!subject.trim() || subject.length > 70) clarity -= 10;
  const lower = `${subject} ${body}`.toLowerCase();
  const spamHits = spamTerms.filter((term) => lower.includes(term));
  const caps = (subject + body).replace(/[^A-Za-z]/g, '');
  const capsRatio = caps.length ? (caps.match(/[A-Z]/g)?.length ?? 0) / caps.length : 0;
  if (capsRatio > 0.3) spamHits.push('excessive capitals');
  const links = (body.match(/https?:\/\//g) ?? []).length;
  if (links > 2) spamHits.push('many links');
  const compliance = [
    { label: 'Includes sender identity', ok: /\{\{sender_name\}\}|Best,|Thanks,/i.test(body) },
    { label: 'Clear reason for contacting', ok: words >= 30 },
    { label: 'Unsubscribe link or opt-out line', ok: /unsubscribe|opt out|reply stop/i.test(body) },
  ];
  return { clarity: Math.max(0, clarity), words, spamHits, compliance };
}
