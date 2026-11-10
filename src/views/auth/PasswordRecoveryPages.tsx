'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import { AuthShell, PasswordField, TextField, FormError } from './LoginPage';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await createBrowserSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not send the reset email.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your inbox" subtitle="If an account exists for that address, a reset link is on its way.">
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-14 h-14 rounded-[16px] neu-inset-sm flex items-center justify-center mb-4">
            <MailCheck className="w-6 h-6 text-accent-foreground" />
          </div>
          <p className="text-[12px] text-muted-foreground mb-6">The link expires shortly. Check your spam folder if it does not arrive.</p>
          <Link href="/login" className="w-full text-center rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50 py-2.5 rounded-xl hover:opacity-90">Back to sign in</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link."
      footer={<Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-accent-foreground hover:underline"><ArrowLeft className="w-3.5 h-3.5" /> Back to sign in</Link>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <TextField id="email" label="Work email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" icon={Mail} />
        <button type="submit" disabled={loading} className="w-full rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60">{loading ? 'Sending...' : 'Send reset link'}</button>
      </form>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return setError('Include upper case, lower case and a number.');
    if (pw !== confirm) return setError('Passwords do not match.');
    setError('');
    setLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error('Open the reset link from your email first, then set a new password.');
      const { error: updateError } = await supabase.auth.updateUser({ password: pw });
      if (updateError) throw updateError;
      setDone(true);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update your password.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
        <Link href="/login" className="block text-center w-full rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50 py-2.5 rounded-xl hover:opacity-90">Go to sign in</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you haven't used before.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <PasswordField id="pw" label="New password" value={pw} onChange={setPw} placeholder="At least 8 characters" autoComplete="new-password" />
        <PasswordField id="pw2" label="Confirm new password" value={confirm} onChange={setConfirm} placeholder="Repeat your password" autoComplete="new-password" />
        <button type="submit" disabled={loading} className="w-full rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-60">{loading ? 'Updating...' : 'Update password'}</button>
      </form>
    </AuthShell>
  );
}
