'use client';

import { useMemo, useState } from 'react';
import { Send, Sparkles, Copy, Save, Wand2, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/shared/ToastProvider';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import type { TemplateVM } from '@/lib/view-models';

type Tone = 'professional' | 'friendly' | 'direct' | 'consultative' | 'formal';

const promptChips = [
  'Write a cold intro for a SaaS founder',
  'Follow-up after no reply',
  'Partnership pitch for an agency',
  'Short re-engagement email',
];

const spamTerms = ['guarantee', 'act now', 'free money', 'risk-free', 'urgent', 'winner', 'no obligation', '100%'];

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

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
    try {
      setMessages((current) => [
        ...current,
        { id: current.length, role: 'user', text: prompt },
        { id: current.length + 1, role: 'assistant', text: 'Generating your draft with Groq…' },
      ]);
      const result = await apiFetch<AiEmailResult>('/api/ai/email', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'generate',
          prompt,
          tone,
          sender: { name: '' },
        }),
      });
      setDraft(result);
      setSubject(result.subject);
      setBody(result.body);
      setMessages((current) => [
        ...current,
        { id: current.length, role: 'assistant', text: 'Here is a first draft. Edit it below or ask me to rewrite it.' },
      ]);
      setInput('');
      setOptimized(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHeader title="AI Email Writer" description="Draft, rewrite, and check cold emails using Groq. Suggestions improve clarity; they cannot guarantee inbox placement or replies." />

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chat */}
        <section className="neu-card rounded-2xl flex flex-col min-h-[460px]">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Writing assistant</h2>
          </div>
          <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[420px]" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', message.role === 'user' ? 'ml-auto bg-accent text-accent-foreground' : 'bg-muted text-foreground')}>
                {message.text}
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-border space-y-3">
            <div className="flex flex-wrap gap-2">
              {promptChips.map((chip) => (
                <button key={chip} onClick={() => send(chip)} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">{chip}</button>
              ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); send(input); }} className="flex gap-2" noValidate>
              <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Describe the email you need…" aria-label="Describe the email" className={inputCls} />
              <button type="submit" disabled={!input.trim() || generating} className="px-4 rounded-xl gradient-blue text-white disabled:opacity-50" aria-label="Send prompt">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Editor and tools */}
        <section className="space-y-6 min-w-0">
          {!draft ? (
            <div className="neu-card rounded-2xl p-8 text-center text-sm text-muted-foreground">Your draft will appear here once you send a prompt.</div>
          ) : (
            <>
              <div className="neu-card rounded-2xl p-5 space-y-4">
                <label className="block text-sm font-medium">Subject
                  <input value={subject} onChange={(event) => { setSubject(event.target.value); setOptimized(false); }} className={cn(inputCls, 'mt-1.5')} />
                </label>
                <label className="block text-sm font-medium">Body
                  <textarea value={body} onChange={(event) => { setBody(event.target.value); setOptimized(false); }} rows={8} className={cn(inputCls, 'mt-1.5')} />
                </label>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-sm font-medium">Tone
                    <select value={tone} onChange={(event) => setTone(event.target.value as Tone)} className={cn(inputCls, 'mt-1.5 w-40')}>
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="direct">Direct</option>
                      <option value="consultative">Consultative</option>
                      <option value="formal">Formal</option>
                    </select>
                  </label>
                  <button onClick={rewrite} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
                    <Wand2 className="w-4 h-4" /> Rewrite tone
                  </button>
                  <button onClick={subjectLines} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
                    <Sparkles className="w-4 h-4" /> Subject lines
                  </button>
                  <button onClick={followUp} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
                    <CheckCircle2 className="w-4 h-4" /> Follow-up
                  </button>
                  <button onClick={optimize} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
                    <ShieldCheck className="w-4 h-4" /> Run optimizer
                  </button>
                  <div className="ml-auto flex gap-2">
                    <button onClick={copy} className="p-2.5 rounded-xl border border-border hover:bg-muted" aria-label="Copy email"><Copy className="w-4 h-4" /></button>
                    <button onClick={saveTemplate} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-blue text-white text-sm font-semibold disabled:opacity-50"><Save className="w-4 h-4" /> Save as template</button>
                  </div>
                </div>
              </div>

              {optimized && (
                <div className="neu-card rounded-2xl p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Optimizer report</h3>
                    <span className="text-sm text-muted-foreground">Clarity score <strong className="text-foreground">{report.clarity}/100</strong></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={report.clarity}>
                    <div className="h-full rounded-full gradient-blue transition-all duration-500" style={{ width: `${report.clarity}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{report.words} words. Clarity measures length, readability, and a clear question. It does not predict deliverability or replies.</p>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Spam-trigger check</p>
                    {report.spamHits.length === 0 ? (
                      <p className="text-sm text-emerald-700 dark:text-emerald-400 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> No common spam-trigger phrases found.</p>
                    ) : (
                      <div className="text-sm text-amber-700 dark:text-amber-400 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> Consider rewording: {report.spamHits.join(', ')}.</div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Compliance checklist</p>
                    <ul className="space-y-2">
                      {report.compliance.map((item) => (
                        <li key={item.label} className="text-sm flex items-center gap-2">
                          {item.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                          <span className={cn('text-foreground', !item.ok && 'text-muted-foreground')}>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="neu-card rounded-2xl p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">Preview</p>
                <p className="font-semibold text-foreground text-sm">{subject || 'No subject'}</p>
                <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">{body}</p>
                <p className="mt-3 text-[11px] text-muted-foreground">Variables like {'{{first_name}}'} are filled in per lead when a campaign sends.</p>
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
