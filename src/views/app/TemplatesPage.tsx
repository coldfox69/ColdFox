'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Copy, Trash2, Eye, Pencil, Users, Lock, FlaskConical } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useToast } from '@/components/shared/ToastProvider';
import { TemplateEditorModal, renderSample } from '@/components/templates/TemplateEditorModal';
import { type TemplateVM as Template } from '@/lib/view-models';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useRouter } from 'next/navigation';

type Scope = 'all' | 'personal' | 'shared';
type Editing = Template | 'new' | null;

const categories = ['All categories', 'Cold Outreach', 'Follow-up', 'Partnership', 'Nurture', 'Re-engagement'];

export default function TemplatesPage({ initialTemplates }: { initialTemplates: Template[] }) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Template[]>(initialTemplates);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [scope, setScope] = useState<Scope>('all');
  const [editing, setEditing] = useState<Editing>(null);
  const [previewing, setPreviewing] = useState<Template | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [testIds, setTestIds] = useState<string[]>([]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(t =>
      (category === 'All categories' || t.category === category) &&
      (scope === 'all' || (scope === 'shared' ? t.isShared : !t.isShared)) &&
      (!q || [t.name, t.subject, t.tags.join(' ')].join(' ').toLowerCase().includes(q)),
    );
  }, [items, query, category, scope]);

  const saveTemplate = async (values: Pick<Template, 'name' | 'subject' | 'body' | 'category' | 'isShared'>) => {
    const payload = {
      name: values.name,
      subject: values.subject,
      body_text: values.body,
      category: values.category,
      is_shared: values.isShared,
      tags: [],
    };
    if (editing === 'new') {
      const created = await apiFetch<Record<string, unknown>>('/api/templates', { method: 'POST', body: JSON.stringify(payload) });
      const now = new Date().toISOString().slice(0, 10);
      setItems(list => [{
        id: String(created.id),
        name: values.name,
        subject: values.subject,
        body: values.body,
        category: values.category,
        tags: [],
        createdAt: now,
        updatedAt: now,
        isShared: values.isShared,
        usageCount: 0,
      }, ...list]);
      toast.show('Template created.', 'success');
    } else if (editing) {
      await apiFetch(`/api/templates/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setItems(list => list.map(t => (t.id === editing.id ? { ...t, ...values, updatedAt: new Date().toISOString().slice(0, 10) } : t)));
      toast.show('Template saved.', 'success');
    }
    setEditing(null);
    router.refresh();
  };

  const duplicate = async (t: Template) => {
    setBusy(t.id);
    try {
      await apiFetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: `${t.name} (copy)`.slice(0, 160),
          subject: t.subject,
          body_text: t.body,
          category: t.category,
          tags: t.tags,
          is_shared: false,
        }),
      });
      toast.show(`Duplicated "${t.name}".`, 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (t: Template) => {
    setBusy(t.id);
    try {
      await apiFetch(`/api/templates/${t.id}`, { method: 'DELETE' });
      setItems(list => list.filter(x => x.id !== t.id));
      setTestIds(ids => ids.filter(id => id !== t.id));
      setConfirmId(null);
      toast.show(`Deleted "${t.name}".`, 'info');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
    }
  };

  const toggleTest = (id: string) => {
    setTestIds(ids => {
      if (ids.includes(id)) return ids.filter(x => x !== id);
      if (ids.length >= 3) {
        toast.show('You can compare up to 3 templates at once.', 'info');
        return ids;
      }
      return [...ids, id];
    });
  };

  const testTemplates = items.filter(t => testIds.includes(t.id));

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-[1440px] mx-auto space-y-6">
      <PageHeader
        title="Templates"
        description="Reusable email copy for your campaigns and sequences."
        actions={
          <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">
            <Plus className="w-4 h-4" /> New template
          </button>
        }
      />

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search templates" aria-label="Search templates" className="w-full pl-9 pr-3 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category" className="px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60">
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <div role="tablist" className="inline-flex gap-1 rounded-[10px] bg-input p-1 shadow-[var(--shadow-inset-sm)]">
          {(['all', 'personal', 'shared'] as const).map(s => (
            <button key={s} role="tab" aria-selected={scope === s} onClick={() => setScope(s)} className={cn('rounded-[8px] px-3 py-1.5 text-[12px] font-medium capitalize transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)]', scope === s ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}>{s}</button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={<Search className="w-8 h-8" />} title="No templates match" description="Try another search, category, or scope." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {visible.map(t => (
            <article key={t.id} className="neu-card rounded-[16px] p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground truncate">{t.name}</h3>
                <StatusBadge variant={t.isShared ? 'info' : 'muted'} size="sm">
                  <span className="inline-flex items-center gap-1">{t.isShared ? <Users className="w-3 h-3" /> : <Lock className="w-3 h-3" />}{t.isShared ? 'Shared' : 'Personal'}</span>
                </StatusBadge>
              </div>
              <p className="text-[12px] text-muted-foreground">{t.category} · Used {t.usageCount} times · Updated {t.updatedAt}</p>
              <p className="text-sm text-foreground/80 line-clamp-3">{renderSample(t.body)}</p>
              <div className="flex flex-wrap gap-1.5">
                {t.tags.map(tag => <span key={tag} className="px-2 py-0.5 rounded-md bg-muted text-[12px] text-muted-foreground">{tag}</span>)}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-auto border-t border-border">
                <button onClick={() => setPreviewing(t)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-muted"><Eye className="w-3.5 h-3.5" /> Preview</button>
                <button onClick={() => setEditing(t)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-muted"><Pencil className="w-3.5 h-3.5" /> Edit</button>
                <button onClick={() => void duplicate(t)} disabled={busy === t.id} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium hover:bg-muted disabled:opacity-50"><Copy className="w-3.5 h-3.5" /> Duplicate</button>
                <button onClick={() => toggleTest(t.id)} aria-pressed={testIds.includes(t.id)} className={cn('inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium', testIds.includes(t.id) ? 'bg-accent text-accent-foreground' : 'hover:bg-muted')}>
                  <FlaskConical className="w-3.5 h-3.5" /> {testIds.includes(t.id) ? 'In test' : 'Add to test'}
                </button>
                {confirmId === t.id ? (
                  <span className="ml-auto flex items-center gap-2 text-[12px]">
                    <button onClick={() => void remove(t)} disabled={busy === t.id} className="px-2 py-1 rounded-lg bg-destructive text-destructive-foreground font-medium disabled:opacity-50">Delete</button>
                    <button onClick={() => setConfirmId(null)} className="px-2 py-1 rounded-lg border border-border font-medium">Keep</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmId(t.id)} aria-label={`Delete ${t.name}`} className="ml-auto p-1.5 rounded-lg text-destructive hover:bg-muted"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="neu-card rounded-[16px] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground">Content test</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Compare up to 3 templates to see which copy gets more replies. Each lead receives one variant at random and results are reported per variant. This tests message content; it does not change how mailbox providers filter email.
        </p>
        {testTemplates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Select templates above with "Add to test" to start a comparison.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            {testTemplates.map(t => (
              <div key={t.id} className="flex-1 rounded-xl border border-border p-3">
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-[12px] text-muted-foreground mt-1">Variant share: {Math.round(100 / testTemplates.length)}%</p>
              </div>
            ))}
          </div>
        )}
        {testTemplates.length > 1 && (
          <button onClick={() => toast.show('Save the templates, then choose them when creating a campaign.', 'info')} className="px-4 py-2 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">
            Use this test in a campaign
          </button>
        )}
      </section>

      {editing && (
        <TemplateEditorModal template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={saveTemplate} />
      )}

      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewing(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="preview-title" className="relative w-full max-w-lg neu-card rounded-[16px] p-6">
            <h2 id="preview-title" className="font-semibold text-foreground mb-1">{previewing.name}</h2>
            <p className="text-[12px] text-muted-foreground mb-4">Sample lead: Sarah at TechFlow</p>
            <p className="text-sm font-semibold text-foreground">{renderSample(previewing.subject)}</p>
            <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">{renderSample(previewing.body)}</p>
            <div className="flex justify-end mt-6">
              <button onClick={() => setPreviewing(null)} className="px-4 py-2 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
