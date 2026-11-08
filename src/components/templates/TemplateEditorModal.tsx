import { useEffect, useState } from 'react';
import { X, Eye, PencilLine, History } from 'lucide-react';
import { type TemplateVM as Template } from '@/lib/view-models';
import { cn } from '@/lib/utils';

type Mode = 'edit' | 'preview' | 'history';

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';

const sampleLead = { first_name: 'Sarah', company: 'TechFlow', industry: 'SaaS', sender_name: 'Alex' };

export function renderSample(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => (key in sampleLead ? sampleLead[key as keyof typeof sampleLead] : `{{${key}}}`));
}

type Props = {
  template: Template | null;
  onClose: () => void;
  onSave: (values: Pick<Template, 'name' | 'subject' | 'body' | 'category' | 'isShared'>) => void | Promise<void>;
};

export function TemplateEditorModal({ template, onClose, onSave }: Props) {
  const [mode, setMode] = useState<Mode>('edit');
  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [category, setCategory] = useState(template?.category ?? 'Cold Outreach');
  const [isShared, setIsShared] = useState(template?.isShared ?? false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return setError('Name, subject, and body are required.');
    setError('');
    try {
      await onSave({ name: name.trim(), subject: subject.trim(), body: body.trim(), category, isShared });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the template.');
    }
  };

  const tabs: { id: Mode; label: string; icon: typeof PencilLine }[] = [
    { id: 'edit', label: 'Edit', icon: PencilLine },
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'history', label: 'Version history', icon: History },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="template-title" className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto neu-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="template-title" className="text-lg font-semibold text-foreground">{template ? 'Edit template' : 'New template'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-muted w-fit mb-5">
          {tabs.map(t => (
            <button key={t.id} role="tab" aria-selected={mode === t.id} onClick={() => setMode(t.id)} className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium', mode === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {mode === 'edit' && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">Name<input value={name} onChange={e => setName(e.target.value)} className={cn(inputCls, 'mt-1.5')} /></label>
            <label className="block text-sm font-medium">Subject<input value={subject} onChange={e => setSubject(e.target.value)} className={cn(inputCls, 'mt-1.5')} /></label>
            <label className="block text-sm font-medium">Body
              <textarea rows={8} value={body} onChange={e => setBody(e.target.value)} className={cn(inputCls, 'mt-1.5')} />
            </label>
            <p className="text-xs text-muted-foreground">Use variables such as {'{{first_name}}'}, {'{{company}}'}, and {'{{industry}}'}.</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">Category
                <select value={category} onChange={e => setCategory(e.target.value)} className={cn(inputCls, 'mt-1.5')}>
                  {['Cold Outreach', 'Follow-up', 'Partnership', 'Nurture', 'Re-engagement'].map(c => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2.5 text-sm font-medium">
                <input type="checkbox" checked={isShared} onChange={e => setIsShared(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                Share with my team
              </label>
            </div>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted">Cancel</button>
              <button onClick={() => void save()} className="px-4 py-2 rounded-xl gradient-blue text-white text-sm font-semibold">Save template</button>
            </div>
          </div>
        )}

        {mode === 'preview' && (
          <div className="rounded-xl border border-border p-5">
            <p className="text-xs text-muted-foreground mb-2">Sample lead: Sarah at TechFlow</p>
            <p className="font-semibold text-sm text-foreground">{renderSample(subject) || 'No subject'}</p>
            <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">{renderSample(body)}</p>
          </div>
        )}

        {mode === 'history' && (
          <ol className="space-y-3">
            <li className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
              <div>
                <p className="font-medium text-foreground">Current version</p>
                <p className="text-xs text-muted-foreground">Updated {template?.updatedAt ?? '—'}</p>
              </div>
              <span className="text-xs text-muted-foreground">Current</span>
            </li>
            <li className="rounded-xl border border-border p-3 text-sm text-muted-foreground">
              Every save creates a new version on the server. Open the template after saving to keep working from the latest copy.
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
