'use client';

import { useState } from 'react';
import { User, Building2, CreditCard, Clock, Check, Loader2, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';
import { COMMON_TIMEZONES } from '@/lib/timezone';

export interface SettingsData {
  profile: Record<string, unknown>;
  organization: Record<string, unknown>;
  members: Array<{ userId: string; name?: string; role: string; status: string; joinedAt: string }>;
  plans: Array<{ key: string; name: string; description: string }>;
}

const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:opacity-60';

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({ icon, title, description, children }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="neu-card rounded-[16px] p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">{icon}</span>
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage({ data }: { data: SettingsData }) {
  const toast = useToast();
  const detectedTz = typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC') : 'UTC';
  const initialTimezone = String(data.profile.timezone ?? data.organization.timezone ?? detectedTz);
  const [fullName, setFullName] = useState(String(data.profile.full_name ?? ''));
  const [jobTitle, setJobTitle] = useState(String(data.profile.job_title ?? ''));
  const [timezone, setTimezone] = useState(initialTimezone);
  const [orgName, setOrgName] = useState(String(data.organization.name ?? ''));
  const [website, setWebsite] = useState(String(data.organization.website ?? ''));
  const [industry, setIndustry] = useState(String(data.organization.industry ?? ''));
  const [companySize, setCompanySize] = useState(String(data.organization.company_size ?? ''));
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const currentPlan = String(data.organization.plan_key ?? '');
  const email = String(data.profile.email ?? data.profile.contact_email ?? '');
  const timezoneOptions = COMMON_TIMEZONES.includes(timezone) ? COMMON_TIMEZONES : [timezone, ...COMMON_TIMEZONES];

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ full_name: fullName, job_title: jobTitle, timezone }),
      });
      toast.show('Profile updated.', 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingOrg(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          organization_name: orgName,
          website,
          industry,
          company_size: companySize,
        }),
      });
      toast.show('Workspace settings updated.', 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    } finally {
      setSavingOrg(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-6 py-6 lg:px-8 lg:py-8">
      <PageHeader title="Settings" description="Manage your profile, your workspace, and the people who can access it." />

      <div className="grid gap-5 lg:grid-cols-5">
        <form onSubmit={saveProfile} className="lg:col-span-3">
          <SectionCard icon={<User className="h-4 w-4" />} title="Your profile" description="How you appear to teammates and in email signatures.">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="full-name" label="Full name">
                  <input id="full-name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" className={inputCls} />
                </Field>
                <Field id="job-title" label="Job title">
                  <input id="job-title" value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Founder" className={inputCls} />
                </Field>
              </div>
              {email && (
                <Field id="email" label="Email address" hint="This is the address you sign in with and cannot be changed here.">
                  <input id="email" value={email} readOnly className={cn(inputCls, 'cursor-not-allowed text-muted-foreground')} />
                </Field>
              )}
              <Field id="timezone" label="Timezone" hint="Campaign send windows and activity times use this timezone. Set once here; it applies across the workspace.">
                <select id="timezone" value={timezone} onChange={e => setTimezone(e.target.value)} className={inputCls}>
                  {timezoneOptions.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                </select>
              </Field>
              <div className="flex justify-end border-t border-border pt-4">
                <button type="submit" disabled={savingProfile} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-60">
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {savingProfile ? 'Saving…' : 'Save profile'}
                </button>
              </div>
            </div>
          </SectionCard>
        </form>

        <form onSubmit={saveOrganization} className="lg:col-span-2">
          <SectionCard icon={<Building2 className="h-4 w-4" />} title="Workspace" description="Details used on invoices and in your account.">
            <div className="space-y-4">
              <Field id="org-name" label="Workspace name">
                <input id="org-name" value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="Company name" className={inputCls} />
              </Field>
              <Field id="website" label="Website">
                <input id="website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://example.com" className={inputCls} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <Field id="industry" label="Industry">
                  <input id="industry" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. SaaS" className={inputCls} />
                </Field>
                <Field id="company-size" label="Company size">
                  <input id="company-size" value={companySize} onChange={e => setCompanySize(e.target.value)} placeholder="e.g. 1-10 employees" className={inputCls} />
                </Field>
              </div>
              <div className="flex justify-end border-t border-border pt-4">
                <button type="submit" disabled={savingOrg} className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:opacity-60">
                  {savingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {savingOrg ? 'Saving…' : 'Save workspace'}
                </button>
              </div>
            </div>
          </SectionCard>
        </form>
      </div>

      <SectionCard icon={<Users className="h-4 w-4" />} title="Team members" description="People with access to this workspace. Roles are managed by the workspace owner.">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
                <th className="px-3 py-2.5 font-semibold">Member</th>
                <th className="px-3 py-2.5 font-semibold">Role</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 text-right font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No members found.</td>
                </tr>
              ) : (
                data.members.map(m => (
                  <tr key={m.userId} className="hover:bg-muted/40">
                    <td className="px-3 py-3">
                      <span className="font-medium text-foreground">{m.name || 'Workspace member'}</span>
                      {!m.name && <span className="ml-2 text-[12px] text-muted-foreground">Invite not accepted</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[12px] font-medium capitalize text-muted-foreground">{m.role}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge variant={m.status === 'active' ? 'success' : 'warning'} size="sm">{m.status}</StatusBadge>
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{m.joinedAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard icon={<CreditCard className="h-4 w-4" />} title="Plans" description="Compare what each plan includes. Changing plans is handled by support.">
        <div className="grid gap-3 sm:grid-cols-2">
          {data.plans.map(p => {
            const isCurrent = p.key === currentPlan;
            return (
              <div key={p.key} className={cn('rounded-[12px] border p-4', isCurrent ? 'border-primary bg-accent/40' : 'border-border bg-card')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-foreground">{p.name}</p>
                  {isCurrent && <StatusBadge variant="info" size="sm">Current plan</StatusBadge>}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{p.description}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-[10px] bg-muted px-3 py-2 text-[12px] text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Need a different plan or an invoice? Open Support and we will help.
        </div>
      </SectionCard>
    </div>
  );
}
