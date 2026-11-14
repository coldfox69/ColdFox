'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, Copy, Trash2, Eye, Pencil, Users, Lock, MoreHorizontal, FileText } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useToast } from '@/components/shared/ToastProvider';
import { TemplateEditorModal, renderSample, type TemplateEditorValues } from '@/components/templates/TemplateEditorModal';
import { type TemplateVM as Template } from '@/lib/view-models';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useRouter } from 'next/navigation';
import { useDebouncedValue } from '@/hooks/use-debounce';

type Scope = 'all' | 'personal' | 'shared';
type Editing = Template | 'new' | null;

const categories = ['All categories', 'Cold Outreach', 'Follow-up', 'Partnership', 'Nurture', 'Re-engagement'];

export default function TemplatesPage({ initialTemplates }: { initialTemplates: Template[] }) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState<Template[]>(initialTemplates);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [category, setCategory] = useState('All categories');
  const [scope, setScope] = useState<Scope>('all');
  const [editing, setEditing] = useState<Editing>(null);
  const [previewing, setPreviewing] = useState<Template | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return items.filter(t =>
      (category === 'All categories' || t.category === category) &&
      (scope === 'all' || (scope === 'shared' ? t.isShared : !t.isShared)) &&
      (!q || [t.name, t.subject, t.tags.join(' ')].join(' ').toLowerCase().includes(q)),
    );
  }, [items, debouncedQuery, category, scope]);

  const filtersActive = Boolean(debouncedQuery.trim()) || category !== 'All categories' || scope !== 'all';

  const saveTemplate = async (values: TemplateEditorValues) => {
    const payload = {
      name: values.name,
      subject: values.subject,
      body_text: values.body,
      category: values.category,
      is_shared: values.isShared,
      tags: [],
      mode: values.mode,
      variants: values.mode === 'group' ? values.variants.map((variant) => ({ subject: variant.subject, body_text: variant.body })) : undefined,
      ai_personalization: values.aiPersonalization,
    };
    if (editing === 'new' || !editing) {
      const created = await apiFetch<Record<string, unknown>>('/api/templates', { method: 'POST', body: JSON.stringify(payload) });
      const now = new Date().toISOString().slice(0, 10);
      const createdVariants = Array.isArray(created.variants) ? (created.variants as Record<string, unknown>[]).map((row, index) => ({ id: String(row.id ?? index), order: Number(row.variant_order ?? index + 1), subject: String(row.subject ?? ''), bodyText: String(row.body_text ?? '') })) : [];
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
        mode: values.mode,
        aiPersonalization: values.aiPersonalization,
        aiReviewed: false,
        variants: values.mode === 'group' ? createdVariants : [],
      }, ...list]);
      toast.show(values.mode === 'group' ? 'Template group created.' : 'Template created.', 'success');
    } else {
      const updated = await apiFetch<Record<string, unknown>>(`/api/templates/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      const updatedVariants = Array.isArray(updated.variants) ? (updated.variants as Record<string, unknown>[]).map((row, index) => ({ id: String(row.id ?? index), order: Number(row.variant_order ?? index + 1), subject: String(row.subject ?? ''), bodyText: String(row.body_text ?? '') })) : [];
      setItems(list => list.map(t => (t.id === editing.id ? {
        ...t,
        name: values.name,
        subject: values.subject,
        body: values.body,
        category: values.category,
        isShared: values.isShared,
        mode: values.mode,
        aiPersonalization: values.aiPersonalization,
        variants: values.mode === 'group' ? updatedVariants : [],
        updatedAt: new Date().toISOString().slice(0, 10),
      } : t)));
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
          mode: t.mode,
          ai_personalization: t.aiPersonalization,
          variants: t.mode === 'group' ? t.variants.map((variant) => ({ subject: variant.subject, body_text: variant.bodyText })) : undefined,
        }),
      });
      toast.show(`Duplicated "${t.name}".`, 'success');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
      setOpenMenu(null);
    }
  };

  const remove = async (t: Template) => {
    setBusy(t.id);
    try {
      await apiFetch(`/api/templates/${t.id}`, { method: 'DELETE' });
      setItems(list => list.filter(x => x.id !== t.id));
      setConfirmId(null);
      setOpenMenu(null);
      toast.show(`Deleted "${t.name}".`, 'info');
      router.refresh();
    } catch (error) {
      toast.show(errorMessage(error), 'danger');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Templates"
        description="Reusable email copy for your campaigns. Write once, then use it in any campaign."
        actions={
          <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">
            <Plus className="h-4 w-4" /> New template
          </button>
        }
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search templates" aria-label="Search templates" className="w-full rounded-[10px] border border-border bg-input py-2.5 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={category} onChange={e => setCategory(e.target.value)} aria-label="Category" className="rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] focus:border-ring focus:ring-[3px] focus:ring-ring/15">
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <div role="tablist" aria-label="Template scope" className="inline-flex gap-1 rounded-[10px] border border-border bg-muted p-1">
            {(['all', 'personal', 'shared'] as const).map(s => (
              <button key={s} role="tab" aria-selected={scope === s} onClick={() => setScope(s)} className={cn('rounded-[7px] px-3 py-1.5 text-[12px] font-medium capitalize transition-colors', scope === s ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground hover:text-foreground')}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="neu-card rounded-[16px]">
          {items.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No templates yet"
              description="Create your first reusable email. You can personalize it with fields like {{first_name}} later."
              action={<button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground"><Plus className="h-4 w-4" /> Create template</button>}
            />
          ) : (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title="No templates match"
              description="Try another search, category, or scope."
              action={filtersActive ? <button onClick={() => { setQuery(''); setCategory('All categories'); setScope('all'); }} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">Clear filters</button> : undefined}
            />
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(t => (
            <article key={t.id} className="neu-card flex flex-col gap-3 rounded-[16px] p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="truncate text-[14px] font-semibold text-foreground">{t.name}</h3>
                <StatusBadge variant={t.isShared ? 'info' : 'muted'} size="sm">
                  <span className="inline-flex items-center gap-1">{t.isShared ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{t.isShared ? 'Shared' : 'Personal'}</span>
                </StatusBadge>
              </div>
              <p className="text-[12px] text-muted-foreground">
                {t.category} · {t.mode === 'group' ? `${t.variants.length} variants · ` : ''}{t.aiPersonalization ? 'AI personalization · ' : ''}Used {t.usageCount} times
              </p>
              <p className="line-clamp-3 text-[13px] leading-relaxed text-foreground/80">{renderSample(t.body)}</p>
              {t.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.tags.map(tag => <span key={tag} className="rounded-md bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">{tag}</span>)}
                </div>
              )}

              <div className="mt-auto flex items-center gap-1.5 border-t border-border pt-3">
                <button onClick={() => setPreviewing(t)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"><Eye className="h-3.5 w-3.5" /> Preview</button>
                <button onClick={() => setEditing(t)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                <div className="relative ml-auto">
                  <button onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)} aria-label={`More actions for ${t.name}`} aria-expanded={openMenu === t.id} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {openMenu === t.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} aria-hidden="true" />
                      <div className="absolute bottom-9 right-0 z-30 w-44 rounded-[12px] border border-border bg-popover py-1 shadow-[var(--shadow-raised-lg)]">
                        {confirmId === t.id ? (
                          <div className="px-3 py-2">
                            <p className="text-[12px] text-muted-foreground">Delete this template?</p>
                            <div className="mt-2 flex gap-2">
                              <button onClick={() => void remove(t)} disabled={busy === t.id} className="rounded-md bg-destructive px-2 py-1 text-[12px] font-medium text-destructive-foreground disabled:opacity-50">Delete</button>
                              <button onClick={() => setConfirmId(null)} className="rounded-md border border-border px-2 py-1 text-[12px] font-medium">Keep</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button onClick={() => void duplicate(t)} disabled={busy === t.id} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-muted disabled:opacity-50"><Copy className="h-4 w-4" /> Duplicate</button>
                            <button onClick={() => setConfirmId(t.id)} className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-destructive hover:bg-muted"><Trash2 className="h-4 w-4" /> Delete</button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditorModal template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={saveTemplate} />
      )}

      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0b1220]/50 backdrop-blur-[2px]" onClick={() => setPreviewing(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="preview-title" className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-raised-lg)]">
            <h2 id="preview-title" className="mb-1 text-[15px] font-semibold text-foreground">{previewing.name}</h2>
            <p className="mb-4 text-[12px] text-muted-foreground">Sample lead: Sarah at TechFlow</p>
            <p className="text-[13px] font-semibold text-foreground">{renderSample(previewing.subject)}</p>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{renderSample(previewing.body)}</p>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setPreviewing(null)} className="rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground hover:bg-muted">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
