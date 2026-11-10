'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, User, Check, X, ArrowRight, MailCheck } from 'lucide-react';
import { AuthShell, PasswordField, TextField, FormError } from './LoginPage';
import { cn } from '@/lib/utils';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColors = ['bg-destructive', 'bg-destructive', 'bg-[var(--cf-warning)]', 'bg-primary', 'bg-[var(--cf-success)]'];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const strength = passwordStrength(form.password);

  const update = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  const rules = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'Upper and lowercase letters', ok: /[A-Z]/.test(form.password) && /[a-z]/.test(form.password) },
    { label: 'At least one number', ok: /\d/.test(form.password) },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim().toLowerCase())) return setError('Enter a valid work email address.');
    if (strength < 2) return setError('Choose a stronger password: at least 8 characters with letters and numbers.');
    if (form.password !== form.confirm) return setError('The two passwords do not match.');
    if (!terms) return setError('Accept the Terms and Privacy Policy to continue.');
    setError('');
    setNeedsConfirmation(false);
    setLoading(true);
    try {
      const cleanEmail = form.email.trim().toLowerCase();
      const { data, error: signUpError } = await createBrowserSupabaseClient().auth.signUp({
        email: cleanEmail,
        password: form.password,
        options: {
          data: { full_name: form.name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        router.replace('/onboarding');
        router.refresh();
        return;
      }
      try {
        const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: cleanEmail, password: form.password });
        if (!signInError) {
          router.replace('/onboarding');
          router.refresh();
          return;
        }
      } catch {}
      setNeedsConfirmation(true);
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="Confirm your address to activate your workspace"
        footer={<>Already confirmed? <Link href="/login" className="font-medium text-accent-foreground hover:underline">Sign in</Link></>}
      >
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full neu-inset-sm">
            <MailCheck className="w-6 h-6 text-accent-foreground" />
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            We sent a confirmation link to <span className="font-medium text-foreground">{form.email.trim().toLowerCase()}</span>. Open it to finish signing up.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start, no credit card needed"
      footer={<>Already have an account? <Link href="/login" className="font-medium text-accent-foreground hover:underline">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <TextField id="name" label="Full name" value={form.name} onChange={update('name')} placeholder="Alex Johnson" icon={User} />
        <TextField id="email" label="Work email" type="email" value={form.email} onChange={update('email')} placeholder="you@company.com" icon={Mail} />
        <div>
          <PasswordField id="password" label="Password" value={form.password} onChange={update('password')} placeholder="Create a password" autoComplete="new-password" />
          {form.password && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-[var(--dur)]', i < strength ? strengthColors[strength] : 'bg-muted')} />
                ))}
              </div>
              <p className="text-[12px] text-muted-foreground">Strength: <span className="font-medium text-foreground">{strengthLabels[strength]}</span></p>
              <ul className="grid grid-cols-1 gap-1">
                {rules.map(r => (
                  <li key={r.label} className={cn('flex items-center gap-1.5 text-[12px]', r.ok ? 'text-[var(--cf-success)]' : 'text-muted-foreground')}>
                    {r.ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />} {r.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div>
          <PasswordField id="confirm" label="Confirm password" value={form.confirm} onChange={update('confirm')} placeholder="Repeat your password" autoComplete="new-password" />
          {form.confirm && (
            <p className={cn('mt-1.5 text-[12px]', form.confirm === form.password ? 'text-[var(--cf-success)]' : 'text-destructive')}>
              {form.confirm === form.password ? 'The passwords match' : 'The passwords do not match'}
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-muted-foreground">
          <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span>I agree to the <Link href="/terms" className="text-accent-foreground hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-accent-foreground hover:underline">Privacy Policy</Link>.</span>
        </label>
        <button type="submit" disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:opacity-60">
          {loading ? 'Creating account' : <>Create account <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
    </AuthShell>
  );
}
