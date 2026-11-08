'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Check, ArrowLeft, ArrowRight, Megaphone, Building2, Target, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

type OnboardingData = {
  fullName: string; jobTitle: string; department: string;
  company: string; website: string; industry: string; companySize: string;
  usage: string; experience: string; monthlyVolume: string;
};

const steps = [
  { label: 'You', icon: Sparkles },
  { label: 'Company', icon: Building2 },
  { label: 'Usage', icon: Target },
  { label: 'Volume', icon: Gauge },
];

const selectClass = 'w-full px-3.5 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const inputClass = selectClass;

const usageOptions = ['Sales', 'Marketing', 'Recruiting', 'Agency', 'Business development', 'Other'];
const experienceOptions = ['Just starting', 'Some experience', 'Experienced', 'Expert'];
const volumeOptions = ['Under 500', '500 - 2,000', '2,000 - 10,000', '10,000+'];

function Choice({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map(opt => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={cn(
            'px-3.5 py-3 rounded-xl border text-sm text-left transition-all',
            value === opt ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'border-border bg-background text-foreground hover:bg-muted'
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    fullName: '', jobTitle: '', department: '', company: '', website: '', industry: '', companySize: '',
    usage: '', experience: '', monthlyVolume: '',
  });
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof OnboardingData) => (value: string) => setData(d => ({ ...d, [key]: value }));
  const field = (key: keyof OnboardingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(key)(e.target.value);

  const validate = (): string => {
    if (step === 0 && (!data.fullName.trim() || !data.jobTitle.trim())) return 'Please add your name and job title.';
    if (step === 1 && (!data.company.trim() || !data.industry || !data.companySize)) return 'Company name, industry, and size are required.';
    if (step === 2 && !data.usage) return 'Choose how you plan to use ColdFox.';
    if (step === 3 && (!data.experience || !data.monthlyVolume)) return 'Select your experience level and expected volume.';
    return '';
  };

  const next = async () => {
    const message = validate();
    if (message) return setError(message);
    setError('');
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: data.fullName.trim(),
          job_title: data.jobTitle.trim(),
          department: data.department,
          company_name: data.company.trim(),
          website: data.website.trim(),
          industry: data.industry,
          company_size: data.companySize,
          intended_usage: data.usage,
          expected_sending_volume: data.monthlyVolume,
          outreach_experience: data.experience,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Could not finish setup.');
      setFinished(true);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not finish setup.');
    } finally {
      setSubmitting(false);
    }
  };

  if (finished) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="neu-card rounded-3xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-5">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">You're all set, {data.fullName.split(' ')[0]}</h1>
          <p className="text-sm text-muted-foreground mb-8">Your workspace for {data.company} is ready. Connect a mailbox and import your first leads to get started.</p>
          <button onClick={() => router.push('/app')} className="w-full gradient-blue text-white font-semibold py-2.5 rounded-xl hover:opacity-90 inline-flex items-center justify-center gap-2">
            Go to dashboard <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const stepTitles = [
    { title: 'Tell us about you', desc: 'This helps us tailor your workspace.' },
    { title: 'About your company', desc: 'We use this to personalize suggestions and templates.' },
    { title: 'How will you use ColdFox?', desc: 'Pick the option that fits best.' },
    { title: 'Your experience and volume', desc: 'Roughly how many outreach emails do you plan to send each month?' },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-xl gradient-blue flex items-center justify-center"><Megaphone className="w-4 h-4 text-white" /></div>
          <span className="font-bold text-lg text-foreground">ColdFox setup</span>
        </div>

        <ol className="flex items-center justify-between mb-8" aria-label="Onboarding progress">
          {steps.map((s, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={s.label} className="flex-1 flex items-center last:flex-none">
                <button
                  type="button"
                  disabled={!done && !active}
                  onClick={() => done && setStep(i)}
                  className="flex flex-col items-center gap-1.5 disabled:cursor-default"
                >
                  <span className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                    done && 'bg-emerald-500 text-white',
                    active && 'gradient-blue text-white shadow-md shadow-blue-500/30',
                    !done && !active && 'bg-muted text-muted-foreground'
                  )}>
                    {done ? <Check className="w-4 h-4" /> : i + 1}
                  </span>
                  <span className={cn('text-[11px] font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{s.label}</span>
                </button>
                {i < steps.length - 1 && <div className={cn('flex-1 h-0.5 mx-2 mb-5 rounded-full', i < step ? 'bg-emerald-500' : 'bg-border')} />}
              </li>
            );
          })}
        </ol>

        <div className="neu-card rounded-3xl p-8">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Step {step + 1} of {steps.length}</p>
          <h1 className="text-xl font-bold text-foreground">{stepTitles[step].title}</h1>
          <p className="text-sm text-muted-foreground mb-6">{stepTitles[step].desc}</p>

          {error && <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

          {step === 0 && (
            <div className="space-y-4">
              <div><label className="text-sm font-medium mb-1.5 block" htmlFor="ob-name">Full name</label><input id="ob-name" className={inputClass} value={data.fullName} onChange={field('fullName')} placeholder="Alex Johnson" /></div>
              <div><label className="text-sm font-medium mb-1.5 block" htmlFor="ob-title">Job title</label><input id="ob-title" className={inputClass} value={data.jobTitle} onChange={field('jobTitle')} placeholder="Head of Sales" /></div>
              <div>
                <label className="text-sm font-medium mb-1.5 block" htmlFor="ob-dept">Department</label>
                <select id="ob-dept" className={selectClass} value={data.department} onChange={field('department')}>
                  <option value="">Select a department</option>
                  {['Sales', 'Marketing', 'Operations', 'Business Development', 'Recruiting', 'Leadership', 'Other'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div><label className="text-sm font-medium mb-1.5 block" htmlFor="ob-company">Company name</label><input id="ob-company" className={inputClass} value={data.company} onChange={field('company')} placeholder="Acme Inc." /></div>
              <div><label className="text-sm font-medium mb-1.5 block" htmlFor="ob-web">Company website</label><input id="ob-web" className={inputClass} value={data.website} onChange={field('website')} placeholder="acme.com" /></div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block" htmlFor="ob-industry">Industry</label>
                  <select id="ob-industry" className={selectClass} value={data.industry} onChange={field('industry')}>
                    <option value="">Select industry</option>
                    {['SaaS', 'Agency', 'Fintech', 'Healthcare', 'Retail', 'Manufacturing', 'Other'].map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block" htmlFor="ob-size">Company size</label>
                  <select id="ob-size" className={selectClass} value={data.companySize} onChange={field('companySize')}>
                    <option value="">Select size</option>
                    {['1-10', '11-50', '51-200', '201-1000', '1000+'].map(d => <option key={d}>{d} employees</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && <Choice options={usageOptions} value={data.usage} onChange={set('usage')} />}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium mb-2">Outreach experience</p>
                <Choice options={experienceOptions} value={data.experience} onChange={set('experience')} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Emails per month (approximate)</p>
                <Choice options={volumeOptions} value={data.monthlyVolume} onChange={set('monthlyVolume')} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8">
            <button
              type="button"
              onClick={() => { setError(''); setStep(s => Math.max(0, s - 1)); }}
              disabled={step === 0}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-0"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button type="button" onClick={() => void next()} disabled={submitting} className="gradient-blue text-white font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60 inline-flex items-center gap-2">
              {submitting ? 'Creating workspace...' : step === steps.length - 1 ? 'Finish setup' : 'Continue'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">You can change any of these answers later in Settings.</p>
      </div>
    </div>
  );
}
