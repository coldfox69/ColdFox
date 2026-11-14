import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { LeadVM as Lead, LeadStatus } from '@/lib/view-models';

const statuses: LeadStatus[] = ['new', 'contacted', 'replied', 'interested', 'not-interested', 'bounced', 'unsubscribed'];
const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60';
const labelCls = 'block text-[13px] font-medium text-foreground';
const primaryBtn = 'rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-50';
const secondaryBtn = 'rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50';

type Props = {
  lead: Lead | null;
  onClose: () => void;
  onSave: (lead: Lead) => void;
  onDelete?: () => void;
};

export function LeadFormModal({ lead, onClose, onSave, onDelete }: Props) {
  const [form, setForm] = useState({
    firstName: lead?.firstName ?? '',
    lastName: lead?.lastName ?? '',
    email: lead?.email ?? '',
    company: lead?.company ?? '',
    jobTitle: lead?.jobTitle ?? '',
    status: (lead?.status ?? 'new') as LeadStatus,
    tags: lead?.tags.join(', ') ?? '',
    nextFollowUp: lead?.nextFollowUp ?? '',
    notes: lead?.notes ?? '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.company.trim()) return setError('First name and company are required.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid email address.');
    setError('');
    onSave({
      id: lead?.id ?? `l${Date.now()}`,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      company: form.company.trim(),
      jobTitle: form.jobTitle.trim(),
      status: form.status,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      source: lead?.source ?? 'Manual',
      lastContacted: lead?.lastContacted,
      nextFollowUp: form.nextFollowUp || undefined,
      notes: form.notes,
      createdAt: lead?.createdAt ?? new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0b1220]/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="lead-form-title" className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-raised-lg)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="lead-form-title" className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">{lead ? 'Edit lead' : 'Add lead'}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <p role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>First name<input className={`${inputCls} mt-1.5`} value={form.firstName} onChange={set('firstName')} /></label>
            <label className={labelCls}>Last name<input className={`${inputCls} mt-1.5`} value={form.lastName} onChange={set('lastName')} /></label>
          </div>
          <label className={labelCls}>Email<input type="email" className={`${inputCls} mt-1.5`} value={form.email} onChange={set('email')} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>Company<input className={`${inputCls} mt-1.5`} value={form.company} onChange={set('company')} /></label>
            <label className={labelCls}>Job title<input className={`${inputCls} mt-1.5`} value={form.jobTitle} onChange={set('jobTitle')} /></label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelCls}>Status
              <select className={`${inputCls} mt-1.5 capitalize`} value={form.status} onChange={set('status')}>
                {statuses.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
              </select>
            </label>
            <label className={labelCls}>Next follow-up<input type="date" className={`${inputCls} mt-1.5`} value={form.nextFollowUp} onChange={set('nextFollowUp')} /></label>
          </div>
          <label className={labelCls}>Tags <span className="text-[12px] font-normal text-muted-foreground">(comma separated)</span><input className={`${inputCls} mt-1.5`} value={form.tags} onChange={set('tags')} placeholder="saas, warm" /></label>
          <label className={labelCls}>Notes<textarea rows={3} className={`${inputCls} mt-1.5`} value={form.notes} onChange={set('notes')} /></label>
          <div className="flex items-center justify-between gap-3 pt-2">
            {onDelete ? (
              <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-destructive hover:underline"><Trash2 className="h-4 w-4" /> Delete lead</button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={secondaryBtn}>Cancel</button>
              <button type="submit" className={primaryBtn}>Save lead</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
