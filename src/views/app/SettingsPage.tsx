'use client';

import { useState } from 'react';
import { User, Building2, CreditCard, Mail, Shield, Clock } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import { apiFetch, errorMessage } from '@/lib/client/api';
import { useToast } from '@/components/shared/ToastProvider';

export interface SettingsData {
  profile: Record<string, unknown>;
  organization: Record<string, unknown>;
  members: Array<{ userId: string; role: string; status: string; joinedAt: string }>;
  plans: Array<{ key: string; name: string; description: string }>;
}

export default function SettingsPage({ data }: { data: SettingsData }) {
  const toast = useToast();
  const [fullName, setFullName] = useState(String(data.profile.full_name ?? ''));
  const [jobTitle, setJobTitle] = useState(String(data.profile.job_title ?? ''));
  const [timezone, setTimezone] = useState(String(data.profile.timezone ?? ''));
  const [orgName, setOrgName] = useState(String(data.organization.name ?? ''));
  const [website, setWebsite] = useState(String(data.organization.website ?? ''));
  const [industry, setIndustry] = useState(String(data.organization.industry ?? ''));
  const [companySize, setCompanySize] = useState(String(data.organization.company_size ?? ''));

  const saveProfile = async () => {
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ full_name: fullName, job_title: jobTitle, timezone }),
      });
      toast.show('Profile updated.', 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  const saveOrganization = async () => {
    try {
      await apiFetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          organization_name: orgName,
          website,
          industry,
          company_size: companySize,
          timezone,
        }),
      });
      toast.show('Workspace settings updated.', 'success');
    } catch (cause) {
      toast.show(errorMessage(cause), 'danger');
    }
  };

  return (
    <div className="px-6 py-6 lg:px-8 lg:py-8 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Manage your profile and workspace settings." />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 neu-card rounded-[16px] p-6">
          <h2 className="font-semibold text-foreground mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="full-name" className="text-sm font-medium mb-1.5 block">Full name</label>
              <input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="job-title" className="text-sm font-medium mb-1.5 block">Job title</label>
              <input
                id="job-title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Your job title"
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="timezone" className="text-sm font-medium mb-1.5 block">Timezone</label>
              <input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="UTC"
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <button onClick={() => void saveProfile()} className="px-4 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">
              <User className="w-4 h-4" /> Save profile
            </button>
          </div>
        </div>

        <div className="lg:col-span-1 neu-card rounded-[16px] p-6">
          <h2 className="font-semibold text-foreground mb-4">Workspace</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="org-name" className="text-sm font-medium mb-1.5 block">Organization name</label>
              <input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Company name"
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="website" className="text-sm font-medium mb-1.5 block">Website</label>
              <input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="industry" className="text-sm font-medium mb-1.5 block">Industry</label>
              <input
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Industry"
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="company-size" className="text-sm font-medium mb-1.5 block">Company size</label>
              <input
                id="company-size"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                placeholder="1-10 employees"
                className="w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <button onClick={() => void saveOrganization()} className="px-4 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">
              <Building2 className="w-4 h-4" /> Save workspace
            </button>
          </div>
        </div>
      </div>

      <div className="neu-card rounded-[16px] p-6">
        <h2 className="font-semibold text-foreground mb-4">Team members</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No members found.</td>
                </tr>
              ) : (
                data.members.map((m) => (
                  <tr key={m.userId} className="hover:bg-muted/40">
                    <td className="px-4 py-3 text-foreground">{m.userId.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${
                        m.role === 'owner' || m.role === 'admin'
                          ? 'neu-inset-sm text-muted-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[12px] font-medium ${
                        m.status === 'active'
                          ? 'neu-inset-sm text-muted-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-right">{m.joinedAt.slice(0, 10)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="neu-card rounded-[16px] p-6">
        <h2 className="font-semibold text-foreground mb-4">Available plans</h2>
        <div className="space-y-3">
          {data.plans.map((p) => (
            <div key={p.key} className="flex items-center justify-between p-3 rounded-[10px] neu-inset-sm">
              <div>
                <p className="font-medium text-foreground">{p.name}</p>
                <p className="text-[12px] text-muted-foreground">{p.description}</p>
              </div>
              <p className="text-sm text-muted-foreground font-mono">{p.key}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
