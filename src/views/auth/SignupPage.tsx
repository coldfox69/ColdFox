'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, User, Check, X, ArrowRight, MailCheck } from 'lucide-react';
import { AuthShell, PasswordField, TextField, FormError, SocialButtons, AuthDivider } from './LoginPage';
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
const strengthColors = ['bg-red-500', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-600'];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const strength = passwordStrength(form.password);

  const update = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Please enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setError('Enter a valid work email address.');
    if (strength < 2) return setError('Choose a stronger password: at least 8 characters with letters and numbers.');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    if (!terms) return setError('You must accept the Terms and Privacy Policy to continue.');
    setError('');
    setLoading(true);
    try {
      const { data, error: signUpError } = await createBrowserSupabaseClient().auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { full_name: form.name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      if (signUpError) throw signUpError;
      setDone(true);
      if (!data.session) {
        setNeedsConfirmation(true);
      } else {
        router.replace('/onboarding');
        router.refresh();
      }
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : 'Could not create your account.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title={needsConfirmation ? 'Check your email' : 'Account created'} subtitle={needsConfirmation ? 'Confirm your address to activate your workspace.' : 'Let\'s personalize your workspace.'}>
        <div className="flex flex-col items-center text-center py-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
            <MailCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="text-sm text-muted-foreground">
            {needsConfirmation
              ? <>We sent a confirmation link to <span className="font-medium text-foreground">{form.email}</span>. Open it to finish signing up.</>
              : 'Taking you to onboarding...'}
          </p>
          {needsConfirmation && <Link href="/login" className="mt-5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">Back to sign in</Link>}
        </div>
      </AuthShell>
    );
  }

  const rules = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
    { label: 'Upper and lowercase letters', ok: /[A-Z]/.test(form.password) && /[a-z]/.test(form.password) },
    { label: 'At least one number', ok: /\d/.test(form.password) },
  ];

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start free. No credit card required."
      footer={<>Already have an account? <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Sign in</Link></>}
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
                  <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < strength ? strengthColors[strength] : 'bg-muted')} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Strength: <span className="font-medium text-foreground">{strengthLabels[strength]}</span></p>
              <ul className="grid grid-cols-1 gap-1">
                {rules.map(r => (
                  <li key={r.label} className={cn('flex items-center gap-1.5 text-xs', r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
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
            <p className={cn('text-xs mt-1.5', form.confirm === form.password ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
              {form.confirm === form.password ? 'Passwords match' : 'Passwords do not match'}
            </p>
          )}
        </div>
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
          <span>I agree to the <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link>.</span>
        </label>
        <button type="submit" disabled={loading} className="w-full gradient-blue text-white font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity inline-flex items-center justify-center gap-2">
          {loading ? 'Creating account...' : <>Create Account <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
      <AuthDivider />
      <SocialButtons onError={setError} />
    </AuthShell>
  );
}
