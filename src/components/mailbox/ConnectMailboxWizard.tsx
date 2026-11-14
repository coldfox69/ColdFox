import { useEffect, useState } from 'react';
import { X, Check, Mail, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Provider = 'gmail' | 'outlook' | 'smtp';

const providers: { id: Provider; label: string; hint: string }[] = [
  { id: 'gmail', label: 'Gmail', hint: 'Sign in with Google and approve sending access.' },
  { id: 'outlook', label: 'Outlook', hint: 'Sign in with Microsoft 365 or Outlook.com.' },
  { id: 'smtp', label: 'SMTP / IMAP', hint: 'Use your own mail server credentials.' },
];

const inputCls = 'w-full rounded-[10px] border border-border bg-input px-3.5 py-2.5 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60';
const primaryBtn = 'inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105 disabled:pointer-events-none disabled:opacity-60';
const secondaryBtn = 'rounded-[10px] border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50';
const steps = ['Provider', 'Account', 'Confirm'];

export interface MailboxConnectInput {
  provider: Provider;
  email: string;
  /** Shown as the From display name when sending campaign email. */
  senderName: string;
  host?: string;
  port?: number;
  /** SMTP auth user. Defaults to the email address when left blank. */
  username?: string;
  password?: string;
  /** Optional IMAP host. Without it, replies are not synchronised. */
  imapHost?: string;
  imapPort?: number;
}

type Props = {
  onClose: () => void;
  onConnect: (input: MailboxConnectInput) => Promise<void> | void;
  configured?: { gmail: boolean; outlook: boolean };
};

export function ConnectMailboxWizard({ onClose, onConnect, configured = { gmail: false, outlook: false } }: Props) {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [email, setEmail] = useState('');
  const [senderName, setSenderName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [username, setUsername] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('993');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const next = () => {
    if (step === 0 && !provider) return setError('Choose a provider to continue.');
    if (step === 1) {
      if (senderName.trim().length < 2) return setError('Enter the sender name that recipients will see, e.g. "Abu Raihan".');
      if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
      if (provider === 'smtp' && (!host.trim() || !/^\d+$/.test(port) || !password)) return setError('Enter the SMTP host, port, and password.');
      if (provider === 'smtp' && imapHost.trim() && !/^\d+$/.test(imapPort)) return setError('Enter a numeric IMAP port, e.g. 993.');
    }
    setError('');
    setStep(s => s + 1);
  };

  const finish = async () => {
    if (!provider) return;
    if ((provider === 'gmail' || provider === 'outlook') && !configured[provider]) {
      setError(`${provider === 'gmail' ? 'Google' : 'Microsoft'} OAuth is not configured on this deployment yet. Use SMTP/IMAP or ask your platform admin.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConnect({
        provider,
        email,
        senderName: senderName.trim(),
        host,
        port: Number(port) || 587,
        username: username.trim() || email,
        password,
        imapHost: imapHost.trim() || undefined,
        imapPort: imapHost.trim() ? Number(imapPort) || 993 : undefined,
      });
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not connect the mailbox.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0b1220]/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="connect-title" className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[16px] border border-border bg-card p-6 shadow-[var(--shadow-raised-lg)]">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="connect-title" className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">Connect a mailbox</h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">Campaigns send from this address. Replies sync back into your inbox.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <ol className="mb-6 flex items-center gap-2" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn('text-[12px]', i <= step ? 'font-medium text-foreground' : 'text-muted-foreground')}>{s}</span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="grid gap-3">
            {providers.map(p => (
              <button
                key={p.id}
                onClick={() => { setProvider(p.id); setError(''); }}
                aria-pressed={provider === p.id}
                className={cn(
                  'rounded-[12px] border p-4 text-left transition-[border-color,background-color,box-shadow]',
                  provider === p.id ? 'border-primary bg-primary/[0.04] shadow-[var(--shadow-raised-sm)]' : 'border-border bg-card hover:border-primary/50',
                )}
              >
                <p className="text-[13px] font-semibold text-foreground">{p.label}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{p.hint}</p>
              </button>
            ))}
          </div>
        )}

        {step === 1 && provider && (
          <div className="space-y-4">
            <label className="block text-[13px] font-medium text-foreground">Sender name
              <input autoFocus value={senderName} onChange={e => setSenderName(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="e.g. Abu Raihan" />
              <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">Recipients see this in the From line of every email sent from this mailbox.</span>
            </label>
            <label className="block text-[13px] font-medium text-foreground">Email address
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="you@company.com" />
            </label>
            {provider === 'smtp' ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <label className="col-span-2 block text-[13px] font-medium text-foreground">SMTP host
                    <input value={host} onChange={e => setHost(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="smtp.gmail.com" />
                  </label>
                  <label className="block text-[13px] font-medium text-foreground">Port
                    <input value={port} onChange={e => setPort(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="465" />
                  </label>
                </div>
                <label className="block text-[13px] font-medium text-foreground">Username
                  <input value={username} onChange={e => setUsername(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder={email || 'you@company.com'} autoComplete="off" />
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">Leave blank if it is the same as the email address.</span>
                </label>
                <label className="block text-[13px] font-medium text-foreground">Password or app password
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={cn(inputCls, 'mt-1.5')} autoComplete="new-password" />
                  <span className="mt-1 block text-[11px] leading-relaxed text-muted-foreground">Use an app-specific password, not your normal account password.</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="col-span-2 block text-[13px] font-medium text-foreground">IMAP host <span className="font-normal text-muted-foreground">(optional)</span>
                    <input value={imapHost} onChange={e => setImapHost(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="imap.gmail.com" />
                  </label>
                  <label className="block text-[13px] font-medium text-foreground">Port
                    <input value={imapPort} onChange={e => setImapPort(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="993" />
                  </label>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">IMAP is needed to sync replies into the inbox. Without it, campaigns still send, but replies are not detected.</p>
              </>
            ) : (
              <p className="flex gap-2 rounded-[10px] border border-border bg-muted/40 p-3 text-[12px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cf-success)]" /> You will be redirected to {provider === 'gmail' ? 'Google' : 'Microsoft'} to approve access. ColdFox never sees your password.</p>
            )}
          </div>
        )}

        {step === 2 && provider && (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cf-success)]/10">
              <Mail className="h-6 w-6 text-[var(--cf-success)]" />
            </div>
            <p className="text-[15px] font-semibold text-foreground">Ready to connect {email}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Sending as <span className="font-medium text-foreground">{senderName}</span></p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {provider === 'smtp'
                ? 'ColdFox tests the SMTP and IMAP connections before saving encrypted credentials.'
                : `You will be redirected to ${provider === 'gmail' ? 'Google' : 'Microsoft'} to approve access.`}
            </p>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-[10px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">{error}</p>}

        <div className="mt-6 flex justify-between">
          <button onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))} className={secondaryBtn}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 2 ? (
            <button onClick={next} className={primaryBtn}>Continue</button>
          ) : (
            <button onClick={() => void finish()} disabled={busy} className={primaryBtn}>
              {busy ? 'Connecting…' : 'Connect mailbox'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
