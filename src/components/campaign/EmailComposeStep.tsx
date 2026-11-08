import { useState } from 'react';
import { Monitor, Smartphone, Save, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TemplateVM } from '@/lib/view-models';

export type EmailDraft = { templateName: string; subject: string; previewText: string; body: string; sender: string };

export type ImportedLead = { firstName: string; lastName: string; email: string; company: string; jobTitle: string; website: string; industry: string };

const variables = ['first_name', 'last_name', 'company', 'job_title', 'website', 'industry'];
const sampleLead = { first_name: 'Sarah', last_name: 'Chen', company: 'TechFlow', job_title: 'VP of Sales', website: 'techflow.io', industry: 'SaaS' };

export function renderMerge(text: string) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => (sampleLead as Record<string, string>)[key] ?? `{{${key}}}`);
}

export function detectedPlaceholders(rows: ImportedLead[]) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const map: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', company: 'company', jobTitle: 'job_title', website: 'website', industry: 'industry' };
  return columns.filter((column) => column in map).map((column) => map[column]);
}

export function EmailComposeStep({
  draft,
  onChange,
  detected,
  templates = [],
  onSaveTemplate,
  saving = false,
}: {
  draft: EmailDraft;
  onChange: (draft: EmailDraft) => void;
  detected: string[];
  templates?: TemplateVM[];
  onSaveTemplate?: () => void | Promise<void>;
  saving?: boolean;
}) {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const set = (key: keyof EmailDraft) => (value: string) => onChange({ ...draft, [key]: value });

  const insert = (token: string) => onChange({ ...draft, body: `${draft.body}{{${token}}}` });

  const chooseTemplate = (id: string) => {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    onChange({ ...draft, templateName: template.name, subject: template.subject, body: template.body });
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-4">
        {templates.length > 0 && (
          <div>
            <label htmlFor="template-start" className="text-sm font-medium mb-1.5 block">Start from a template</label>
            <select id="template-start" defaultValue="" onChange={(event) => chooseTemplate(event.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Write a new message</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Template name" value={draft.templateName} onChange={set('templateName')} placeholder="Intro - SaaS founders" />
          <Field label="Sender identity" value={draft.sender} onChange={set('sender')} placeholder="Your name" />
        </div>
        <Field label="Subject line" value={draft.subject} onChange={set('subject')} placeholder="Quick question about {{company}}" />
        <Field label="Preview text" value={draft.previewText} onChange={set('previewText')} placeholder="A short line shown next to the subject" />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="email-body" className="text-sm font-medium">Email body</label>
            <span className="text-xs text-muted-foreground">{draft.body.length} characters</span>
          </div>
          <textarea id="email-body" rows={9} value={draft.body} onChange={(event) => set('body')(event.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring" />
          <p className="text-xs text-muted-foreground mt-1.5">
            Plain text. ColdFox appends a compliant unsubscribe footer automatically; do not add a fake opt-out.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Insert personalization</p>
          <div className="flex flex-wrap gap-2">
            {variables.map((variable) => (
              <button key={variable} type="button" onClick={() => insert(variable)}
                className={cn('px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors',
                  detected.includes(variable) ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' : 'border-border bg-background text-foreground hover:bg-muted')}>
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Green chips match mapped columns in your imported lead file.</p>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Merge preview</p>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button aria-label="Desktop preview" aria-pressed={previewMode === 'desktop'} onClick={() => setPreviewMode('desktop')} className={cn('p-1.5 rounded-md', previewMode === 'desktop' && 'bg-card shadow-sm')}><Monitor className="w-3.5 h-3.5" /></button>
            <button aria-label="Mobile preview" aria-pressed={previewMode === 'mobile'} onClick={() => setPreviewMode('mobile')} className={cn('p-1.5 rounded-md', previewMode === 'mobile' && 'bg-card shadow-sm')}><Smartphone className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className={cn('neu-card rounded-2xl p-4 mx-auto transition-all', previewMode === 'mobile' ? 'max-w-[300px]' : 'max-w-full')}>
          <p className="text-xs text-muted-foreground">Sample lead: Sarah Chen &lt;sarah.chen@techflow.io&gt;</p>
          <p className="font-semibold text-sm text-foreground mt-1">{renderMerge(draft.subject) || 'Subject line'}</p>
          <p className="text-xs text-muted-foreground mb-3">{renderMerge(draft.previewText)}</p>
          <div className="text-sm text-foreground whitespace-pre-line leading-relaxed border-t border-border pt-3">
            {renderMerge(draft.body) || 'Your email body will appear here.'}
          </div>
        </div>
        {onSaveTemplate && (
          <button type="button" onClick={() => void onSaveTemplate()} disabled={saving}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save as template'}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium mb-1.5 block">{label}</label>
      <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
