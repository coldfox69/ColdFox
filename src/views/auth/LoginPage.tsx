'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, Eye, EyeOff, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl gradient-blue flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-xl text-foreground">ColdFox</span>
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

export function SocialButtons({ onError }: { onError?: (message: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  const start = async (provider: 'google' | 'azure') => {
    setBusy(provider);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` },
      });
      if (error) throw error;
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'That sign-in provider is unavailable. Use email and password instead.');
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {([{ label: 'Google', provider: 'google' }, { label: 'Microsoft', provider: 'azure' }] as const).map(p => (
        <button
          key={p.provider}
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void start(p.provider)}
          className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
        >
          Continue with {p.label}
        </button>
      ))}
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid work email address.');
    if (password.length < 1) return setError('Enter your password.');
    setLoading(true);
    try {
      const { error: signInError } = await createBrowserSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
      router.replace('/app');
      router.refresh();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Could not sign in. Check your email and password.');
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
      <AuthDivider />
      <SocialButtons onError={setError} />
      <p className="text-[11px] text-muted-foreground text-center mt-6">By signing in you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
    </AuthShell>
  );
}
