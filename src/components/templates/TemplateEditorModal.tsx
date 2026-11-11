'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, Trash2, Copy, Check, Users, FileText, Layers, FlaskConical, ListPlus, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import type { TemplateVM as Template } from '@/lib/view-models';

const SAMPLE: Record<string, string> = {
  first_name: 'Sarah',
  last_name: 'Chen',
  company_name: 'TechFlow',
  company: 'TechFlow',
  job_title: 'Head of Growth',
  website: 'techflow.io',
  industry: 'SaaS',
  email: 'sarah@techflow.io',
  city: 'Austin',
  country: 'USA',
  sender_name: 'Alex',
  sender_company: 'Acme',
};

export function renderSample(text: string): string {
  return String(text ?? '').replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (raw, key: string) => SAMPLE[key] ?? raw);
}

export interface TemplateEditorValues {
  name: string;
  subject: string;
  body: string;
  category: string;
  isShared: boolean;
  mode: 'single' | 'group';
  variants: { subject: string; body: string }[];
  aiPersonalization: boolean;
}

interface VariantDraft {
  key: number;
  id?: string;
  subject: string;
  body: string;
}

const categories = ['Cold Outreach', 'Follow-up', 'Partnership', 'Nurture', 'Re-engagement', 'General'];
const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

interface ReviewResult {
  original: { subject: string; body_text: string };
  improved: { subject: string; body_text: string };
  changes: string[];
  issues: string[];
  disclaimer: string;
}

export function TemplateEditorModal({
  template,
  onClose,
  onSave,
}: {
  template: Template | null;
  onClose: () => void;
  onSave: (values: TemplateEditorValues) => Promise<void>;
}) {
  const toast = useToast();
  const [chooseMode, setChooseMode] = useState<Template['mode'] | null>(template ? template.mode : null);
  const [name, setName] = useState(template?.name ?? '');
  const [category, setCategory] = useState(template?.category ?? 'Cold Outreach');
  const [isShared, setIsShared] = useState(template?.isShared ?? false);
  const [aiPersonalization, setAiPersonalization] = useState(template?.aiPersonalization ?? false);
  const [variants, setVariants] = useState<VariantDraft[]>(() => {
    if (!template || template.variants.length === 0) {
      return [{ key: 1, subject: template?.subject ?? '', body: template?.body ?? '' }];
    }
    return template.variants.map((variant, index) => ({ key: index + 1, id: variant.id, subject: variant.subject, body: variant.bodyText }));
  });
  const [activeInsert, setActiveInsert] = useState<{ variantIndex: number; field: 'subject' | 'body' } | null>(null);
  const [leadLists, setLeadLists] = useState<{ id: string; name: string; placeholders: string[]; placeholdersDetail: { key: string; label: string; description: string; example: string; original: string }[] }[]>([]);
  const [variableList, setVariableList] = useState<string>('union');
  const [reviewFor, setReviewFor] = useState<number | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [samples, setSamples] = useState<{ lead_id: string; email: string; subject: string; body: string; ai: boolean; notes: string[] }[]>([]);
  const [busy, setBusy] = useState(false);

  const subjectRefs = useRef<(HTMLInputElement | null)[]>([]);
  const bodyRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const nextKey = useRef(variants.length + 1);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const lists = await apiFetch<{ id: string; name: string; placeholders: string[]; placeholdersDetail: never[] }[]>('/api/lead-lists');
        if (!cancelled) setLeadLists(lists as never);
      } catch {
        if (!cancelled) setLeadLists([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedList = variableList !== 'union' ? leadLists.find((l) => l.id === variableList) ?? null : null;
  const activeVariables = useMemo(() => {
    if (selectedList) return selectedList.placeholdersDetail;
    const seen = new Map<string, (typeof leadLists)[number]['placeholdersDetail'][number]>();
    for (const list of leadLists) {
      for (const detail of list.placeholdersDetail) if (!seen.has(detail.key)) seen.set(detail.key, detail);
    }
    return [...seen.values()];
  }, [selectedList, leadLists]);

  const isGroup = chooseMode === 'group';

  const insertPlaceholder = (key: string) => {
    const target = activeInsert ?? { variantIndex: 0, field: 'body' as const };
    const ref = target.field === 'subject' ? subjectRefs.current[target.variantIndex] : bodyRefs.current[target.variantIndex];
    const placeholder = `{{${key}}}`;
    setVariants((prev) => prev.map((variant, index) => {
      if (index !== target.variantIndex) return variant;
      const field = target.field;
      const current = field === 'subject' ? variant.subject : variant.body;
      if (!ref) return { ...variant, [field]: `${current}${placeholder}` };
      const start = ref.selectionStart ?? current.length;
      const end = ref.selectionEnd ?? current.length;
      const next = `${current.slice(0, start)}${placeholder}${current.slice(end)}`;
      window.requestAnimationFrame(() => {
        ref.focus();
        const caret = start + placeholder.length;
        ref.setSelectionRange(caret, caret);
      });
      return { ...variant, [field]: next };
    }));
  };

  const copyPlaceholder = (key: string) => {
    void navigator.clipboard.writeText(`{{${key}}}`);
    toast.show(`Copied {{${key}}}`, 'info');
  };

  const addVariant = () => {
    if (variants.length >= 10) {
      toast.show('Your plan allows up to 10 variants per template group.', 'info');
      return;
    }
    setVariants((prev) => [...prev, { key: nextKey.current++, subject: '', body: '' }]);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateVariant = (index: number, field: 'subject' | 'body', value: string) => {
    setVariants((prev) => prev.map((variant, i) => (i === index ? { ...variant, [field]: value } : variant)));
  };

  const runReview = async (index: number) => {
    const variant = variants[index];
    setReviewFor(index);
    setReviewBusy(true);
    setReview(null);
    try {
      const result = await apiFetch<ReviewResult>('/api/ai/deliverability-review', {
        method: 'POST',
        body: JSON.stringify({ subject: variant.subject, body_text: variant.body }),
      });
      setReview(result);
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
      setReviewFor(null);
    } finally {
      setReviewBusy(false);
    }
  };

  const acceptReview = () => {
    if (!review || reviewFor === null) return;
    updateVariant(reviewFor, 'subject', review.improved.subject);
    updateVariant(reviewFor, 'body', review.improved.body_text);
    toast.show('AI improvements applied to the variant.', 'success');
    setReview(null);
    setReviewFor(null);
  };

  const showSamples = async () => {
    if (!template) {
      toast.show('Save the template first, then preview samples.', 'info');
      return;
    }
    setSampleBusy(true);
    try {
      const result = await apiFetch<{ samples: { lead_id: string; email: string; subject: string; body: string; ai: boolean; notes: string[] }[] }>(
        `/api/templates/${template.id}/personalize-sample`,
        { method: 'POST', body: JSON.stringify({ lead_list_id: variableList !== 'union' ? variableList : undefined }) },
      );
      setSamples(result.samples);
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setSampleBusy(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return toast.show('Give the template a name.', 'danger');
    const cleaned = variants.map((variant) => ({ ...variant, subject: variant.subject.trim(), body: variant.body.trim() })).filter((variant) => variant.subject && variant.body);
    if (!cleaned.length) return toast.show('Add at least one complete subject and body.', 'danger');
    setBusy(true);
    try {
      await onSave({
        name: name.trim(),
        subject: cleaned[0].subject,
        body: cleaned[0].body,
        category: category.trim() || 'General',
        isShared,
        mode: isGroup ? 'group' : 'single',
        variants: cleaned.map((v) => ({ subject: v.subject, body: v.body })),
        aiPersonalization,
      });
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (!template && !chooseMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
        <div role="dialog" aria-modal="true" aria-labelledby="template-mode-title" className="relative w-full max-w-md neu-card rounded-[16px] p-6">
          <button type="button" aria-label="Close" onClick={onClose} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          <h2 id="template-mode-title" className="text-lg font-semibold text-foreground mb-1">Create a template</h2>
          <p className="text-sm text-muted-foreground mb-5">Choose what kind of template you want to build.</p>
          <div className="grid gap-3">
            <button type="button" onClick={() => setChooseMode('single')} className="text-left rounded-[16px] border border-border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-raised-sm)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] neu-inset-sm flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
                <div>
                  <span className="font-semibold text-foreground block">Single Template</span>
                  <span className="text-[12px] text-muted-foreground">One subject and body, reused for every recipient.</span>
                </div>
              </div>
            </button>
            <button type="button" onClick={() => setChooseMode('group')} className="text-left rounded-[16px] border border-border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-raised-sm)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] neu-inset-sm flex items-center justify-center"><Layers className="w-5 h-5 text-primary" /></div>
                <div>
                  <span className="font-semibold text-foreground block">Multiple Templates</span>
                  <span className="text-[12px] text-muted-foreground">A template group with variants that rotate per recipient.</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const title = template ? `Edit ${template.name}` : isGroup ? 'New template group' : 'New single template';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="template-editor-title" className="relative w-full max-w-3xl neu-card rounded-[16px] my-6">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <h2 id="template-editor-title" className="text-lg font-semibold text-foreground truncate">{title}</h2>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {isGroup ? <><Layers className="w-3 h-3" /> Multiple</> : <><FileText className="w-3 h-3" /> Single</>}
            </span>
            {aiPersonalization && <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"><Sparkles className="w-3 h-3" /> AI personalized</span>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-6 max-h-[78vh] overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="tname" className="text-sm font-medium mb-1.5 block">{isGroup ? 'Template group name' : 'Template name'}</label>
              <input id="tname" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={isGroup ? 'Q4 SaaS founders variants' : 'Quick question about {{company_name}}'} />
            </div>
            <div>
              <label htmlFor="tcat" className="text-sm font-medium mb-1.5 block">Category</label>
              <select id="tcat" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium self-end pb-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
              Shared with workspace
            </label>
          </div>

          {variants.map((variant, index) => (
            <fieldset key={variant.key} className="rounded-[16px] border border-border p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <legend className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  {isGroup ? `Variant ${index + 1}` : 'Email content'}
                  {reviewFor === index && reviewBusy && <span className="inline-flex items-center gap-1 text-accent-foreground normal-case font-normal"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reviewing…</span>}
                </legend>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void runReview(index)} disabled={reviewBusy || !variant.subject.trim() || !variant.body.trim()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border hover:bg-muted disabled:opacity-50">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> AI Deliverability Review
                  </button>
                  {isGroup && variants.length > 1 && (
                    <button type="button" aria-label={`Remove variant ${index + 1}`} onClick={() => removeVariant(index)} className="p-1.5 rounded-lg text-destructive hover:bg-muted"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
              <div className="grid gap-3">
                <div>
                  <label htmlFor={`subject-${variant.key}`} className="text-sm font-medium mb-1.5 block">Subject line</label>
                  <input id={`subject-${variant.key}`} ref={(el) => { subjectRefs.current[index] = el; }} onFocus={() => setActiveInsert({ variantIndex: index, field: 'subject' })} className={inputCls} value={variant.subject} onChange={(e) => updateVariant(index, 'subject', e.target.value)} placeholder="Hello {{first_name}}, a quick question about {{company_name}}" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor={`body-${variant.key}`} className="text-sm font-medium">Email body</label>
                    <span className="text-[11px] text-muted-foreground">Plain text · placeholders supported</span>
                  </div>
                  <textarea id={`body-${variant.key}`} ref={(el) => { bodyRefs.current[index] = el; }} onFocus={() => setActiveInsert({ variantIndex: index, field: 'body' })} rows={7} className={cn(inputCls, 'leading-relaxed')} value={variant.body} onChange={(e) => updateVariant(index, 'body', e.target.value)} placeholder={'Hi {{first_name}},\n\nI came across {{company_name}} and wanted to reach out.\n\nBest regards,\nAlex'} />
                </div>
              </div>

              {reviewFor === index && review && (
                <div className="mt-4 rounded-[14px] border border-border bg-muted/40 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">AI suggested improvements</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-card border border-border p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Original</p>
                      <p className="text-[13px] font-semibold text-foreground">{review.original.subject}</p>
                      <p className="mt-2 text-[13px] whitespace-pre-wrap text-foreground/90">{review.original.body_text}</p>
                    </div>
                    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Improved</p>
                      <p className="text-[13px] font-semibold text-foreground">{review.improved.subject}</p>
                      <p className="mt-2 text-[13px] whitespace-pre-wrap text-foreground/90">{review.improved.body_text}</p>
                    </div>
                  </div>
                  {review.changes.length > 0 && (
                    <ul className="mt-3 text-[12px] text-muted-foreground list-disc pl-5 space-y-1">
                      {review.changes.map((change, i) => <li key={i}>{change}</li>)}
                    </ul>
                  )}
                  {review.issues.length > 0 && (
                    <div className="mt-3 rounded-xl border border-[var(--cf-warning)]/40 bg-[var(--cf-warning)]/10 p-3">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground"><AlertTriangle className="w-3.5 h-3.5" /> Check these yourself</p>
                      <ul className="mt-1 text-[12px] text-muted-foreground list-disc pl-5 space-y-1">
                        {review.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}
                  <p className="mt-3 text-[11px] text-muted-foreground">{review.disclaimer}</p>
                  <div className="flex items-center gap-2 mt-4">
                    <button type="button" onClick={acceptReview} className="px-4 py-2 rounded-[10px] bg-primary text-xs font-medium text-primary-foreground hover:brightness-110">Accept changes</button>
                    <button type="button" onClick={() => { setReview(null); setReviewFor(null); }} className="px-4 py-2 rounded-[10px] border border-border text-xs font-medium hover:bg-muted">Keep original</button>
                  </div>
                </div>
              )}
            </fieldset>
          ))}

          {isGroup && (
            <button type="button" onClick={addVariant} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border border-dashed border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/60">
              <ListPlus className="w-4 h-4" /> Add more
            </button>
          )}

          <section aria-labelledby="variables-title" className="rounded-[16px] border border-border p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <h3 id="variables-title" className="text-sm font-semibold text-foreground">Available Personalization Variables</h3>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                Lead list
                <select className="rounded-[8px] border border-transparent bg-input px-2 py-1.5 text-[12px]" value={variableList} onChange={(e) => setVariableList(e.target.value)}>
                  <option value="union">All lists (union)</option>
                  {leadLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                </select>
              </label>
            </div>
            <p className="text-[12px] text-muted-foreground mb-3">Click a variable to insert it at the cursor, or copy it. Values come from the columns of the selected lead list.</p>
            {activeVariables.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Import a lead list to see its personalization variables.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {activeVariables.map((variable) => (
                  <li key={variable.key} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                    <button type="button" onClick={() => insertPlaceholder(variable.key)} title="Insert at cursor" className="min-w-0 flex-1 text-left">
                      <span className="block text-[13px] font-medium text-foreground truncate"><code className="rounded bg-muted px-1.5 py-0.5 text-[12px]">{`{{${variable.key}}}`}</code></span>
                      <span className="block text-[11px] text-muted-foreground mt-1 truncate">{variable.description}{variable.example ? ` · e.g. ${variable.example}` : ''}</span>
                    </button>
                    <button type="button" aria-label={`Copy {{${variable.key}}}`} onClick={() => copyPlaceholder(variable.key)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"><Copy className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[16px] border border-border p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div>
                <label htmlFor="ai-personalization" className="flex items-center gap-2 cursor-pointer select-none">
                  <input id="ai-personalization" type="checkbox" checked={aiPersonalization} onChange={(e) => setAiPersonalization(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
                  <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1"><Sparkles className="w-4 h-4 text-primary" /> AI Personalization</span>
                </label>
                <p className="text-[12px] text-muted-foreground mt-1 ml-6">For each recipient, AI writes a variation of this template using only their verified lead data. The original stays the reference; if generation fails, the approved original is sent.</p>
              </div>
              <button type="button" onClick={() => void showSamples()} disabled={sampleBusy} className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border border-border text-[12px] font-medium hover:bg-muted disabled:opacity-50 whitespace-nowrap">
                {sampleBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5 text-primary" />} Preview sample
              </button>
            </div>
            {samples.length > 0 && (
              <ul className="mt-4 grid gap-3">
                {samples.map((sample) => (
                  <li key={sample.lead_id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <span className="text-[12px] font-medium text-muted-foreground">{sample.email}{sample.ai ? ' · AI' : ' · template'}</span>
                      {sample.notes.length > 0 && <span className="text-[11px] text-muted-foreground">{sample.notes.join(' · ')}</span>}
                    </div>
                    <p className="text-[13px] font-semibold text-foreground">{sample.subject}</p>
                    <p className="mt-1 text-[13px] whitespace-pre-wrap text-foreground/90">{sample.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border px-6 py-4">
          <p className="text-[11px] text-muted-foreground">AI review and samples never send email. You confirm every send.</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-[10px] border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:-translate-y-px hover:brightness-110 disabled:opacity-60">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save template</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
