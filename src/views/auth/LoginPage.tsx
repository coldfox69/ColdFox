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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center mb-8">
          <span className="rounded-2xl bg-white p-2 shadow-[var(--neu-elevated)]">
            <Image src="/logo.png" alt="ColdFox - Smarter Cold Email Outreach" width={180} height={45} className="h-11 w-auto" priority />
          </span>
        </Link>
        <div className="neu-card rounded-3xl p-8">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">{subtitle}</p>
          {children}
        </div>
        {footer && <div className="text-center text-sm text-muted-foreground mt-6">{footer}</div>}
      </div>
    </div>
  );
}

export function PasswordField({ id, label, value, onChange, placeholder, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground mb-1.5 block">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
      <label htmlFor={id} className="text-sm font-medium text-foreground mb-1.5 block">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />}
        <input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn('w-full py-2.5 pr-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring', Icon ? 'pl-9' : 'px-4')}
        />
      </div>
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground">or</span>
      <div className="flex-1 h-px bg-border" />
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
      // Admin email goes straight to admin panel (explicit next wins).
      if (!searchParams.get('next') && data.user?.email?.toLowerCase() === 'coldfox6969@gmail.com') {
        router.replace('/admin');
      } else {
        router.replace(next);
      }
      router.refresh();
    } catch (signInError) {
      const msg = signInError instanceof Error ? signInError.message : 'Could not sign in. Check your email and password.';
      if (/email not confirmed/i.test(msg)) {
        setError('Please confirm your email first, then sign in. Check your inbox for the confirmation link.');
      } else if (/invalid login/i.test(msg)) {
        setError('Invalid email or password. If you just signed up, use the same password you chose.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to your outreach dashboard."
      footer={<>New to ColdFox? <Link href="/signup" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <TextField id="email" label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" icon={Mail} />
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} placeholder="Enter your password" autoComplete="current-password" />
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading} className="w-full gradient-blue text-white font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity inline-flex items-center justify-center gap-2">
          {loading ? 'Signing in...' : <>Sign In <ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
      <p className="text-[11px] text-muted-foreground text-center mt-6">By signing in you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
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
