'use client';

import { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center">
          <Image src="/logo.png" alt="ColdFox - Smarter Cold Email Outreach" width={200} height={80} style={{ height: '64px', width: 'auto', maxWidth: '100%' }} priority />
        </Link>
        <div className="neu-card rounded-[20px] p-7 sm:p-8">
          <h1 className="text-[22px] font-semibold text-foreground">{title}</h1>
          <p className="mb-6 mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
          {children}
        </div>
        {footer && <div className="mt-6 text-center text-[13px] text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

const fieldClass = 'w-full rounded-[10px] border border-transparent bg-input py-2.5 pl-9 pr-3 text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50';

export function PasswordField({ id, label, value, onChange, placeholder, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-foreground">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(fieldClass, 'pr-10')}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-[var(--dur)] hover:text-foreground"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export function TextField({ id, label, type = 'text', value, onChange, placeholder, icon: Icon }: { id: string; label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-foreground">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={fieldClass}
        />
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-[10px] bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
      <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[12px] text-muted-foreground">or</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function safeNext(raw: string | null): string {
  if (!raw) return '/app';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || raw.includes('://')) return '/app';
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError('Enter a valid work email address.');
    if (password.length < 1) return setError('Enter your password.');
    setLoading(true);
    try {
      const { data, error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: cleanEmail, password });
      if (signInError) throw signInError;
      const next = safeNext(searchParams.get('next'));
      // Admin lands on the admin panel unless a specific destination was asked for.
      if (!searchParams.get('next') && data.user?.email?.toLowerCase() === 'coldfox6969@gmail.com') {
        router.replace('/admin');
      } else {
        router.replace(next);
      }
      router.refresh();
    } catch (signInError) {
      const msg = signInError instanceof Error ? signInError.message : 'Could not sign in. Check your email and password.';
      if (/email not confirmed/i.test(msg)) {
        setError('Confirm your email address first, then sign in. Use the link in the confirmation email.');
      } else if (/invalid login/i.test(msg)) {
        setError('That email and password do not match. If you just signed up, use the password you chose.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Continue to your outreach workspace"
      footer={<>New to ColdFox? <Link href="/signup" className="font-medium text-accent-foreground hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <TextField id="email" label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" icon={Mail} />
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-[12px] font-medium text-accent-foreground hover:underline">Forgot password</Link>
        </div>
        <button type="submit" disabled={loading} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:opacity-60">
          {loading ? 'Signing in' : <>Sign in <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
      <p className="mt-6 text-center text-[12px] text-muted-foreground">By signing in you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
