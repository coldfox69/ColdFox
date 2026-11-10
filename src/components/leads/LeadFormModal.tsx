import { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { LeadVM as Lead, LeadStatus } from '@/lib/view-models';

const statuses: LeadStatus[] = ['new', 'contacted', 'replied', 'interested', 'not-interested', 'bounced', 'unsubscribed'];
const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="lead-form-title" className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto neu-card rounded-[16px] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="lead-form-title" className="text-lg font-semibold text-foreground">{lead ? 'Edit lead' : 'Add lead'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium">First name<input className={`${inputCls} mt-1.5`} value={form.firstName} onChange={set('firstName')} /></label>
            <label className="text-sm font-medium">Last name<input className={`${inputCls} mt-1.5`} value={form.lastName} onChange={set('lastName')} /></label>
          </div>
          <label className="block text-sm font-medium">Email<input type="email" className={`${inputCls} mt-1.5`} value={form.email} onChange={set('email')} /></label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium">Company<input className={`${inputCls} mt-1.5`} value={form.company} onChange={set('company')} /></label>
            <label className="text-sm font-medium">Job title<input className={`${inputCls} mt-1.5`} value={form.jobTitle} onChange={set('jobTitle')} /></label>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium">Status
              <select className={`${inputCls} mt-1.5`} value={form.status} onChange={set('status')}>
                {statuses.map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Next follow-up<input type="date" className={`${inputCls} mt-1.5`} value={form.nextFollowUp} onChange={set('nextFollowUp')} /></label>
          </div>
          <label className="block text-sm font-medium">Tags <span className="text-[12px] text-muted-foreground font-normal">(comma separated)</span><input className={`${inputCls} mt-1.5`} value={form.tags} onChange={set('tags')} placeholder="saas, warm" /></label>
          <label className="block text-sm font-medium">Notes<textarea rows={3} className={`${inputCls} mt-1.5`} value={form.notes} onChange={set('notes')} /></label>
          <div className="flex items-center justify-between pt-2">
            {onDelete ? (
              <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline"><Trash2 className="w-4 h-4" /> Delete lead</button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">Save lead</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
