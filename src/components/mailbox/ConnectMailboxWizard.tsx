import { useEffect, useState } from 'react';
import { X, Check, Mail, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Provider = 'gmail' | 'outlook' | 'smtp';

const providers: { id: Provider; label: string; hint: string }[] = [
  { id: 'gmail', label: 'Gmail', hint: 'Sign in with Google and approve sending access.' },
  { id: 'outlook', label: 'Outlook', hint: 'Sign in with Microsoft 365 or Outlook.com.' },
  { id: 'smtp', label: 'SMTP / IMAP', hint: 'Use your own mail server credentials.' },
];

const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="connect-title" className="relative w-full max-w-lg neu-card rounded-[16px] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="connect-title" className="text-lg font-semibold text-foreground">Connect a mailbox</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <ol className="flex items-center gap-2 mb-6" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2 flex-1">
              <span className={cn('w-6 h-6 rounded-full text-[12px] font-semibold flex items-center justify-center', i <= step ? 'rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50' : 'bg-muted text-muted-foreground')}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </span>
              <span className={cn('text-[12px]', i <= step ? 'text-foreground' : 'text-muted-foreground')}>{s}</span>
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
                  'text-left p-4 rounded-xl border transition-[color,background-color,box-shadow,transform,opacity] duration-[var(--dur)] ease-[var(--ease)]',
                  provider === p.id ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
                )}
              >
                <p className="font-medium text-foreground text-sm">{p.label}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5">{p.hint}</p>
              </button>
            ))}
          </div>
        )}

        {step === 1 && provider && (
          <div className="space-y-4">
            <label className="block text-sm font-medium">Sender name
              <input autoFocus value={senderName} onChange={e => setSenderName(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="e.g. Abu Raihan" />
              <span className="mt-1 block text-[11px] text-muted-foreground">Recipients see this in the From line of every email sent from this mailbox.</span>
            </label>
            <label className="block text-sm font-medium">Email address
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="you@company.com" />
            </label>
            {provider === 'smtp' ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <label className="col-span-2 block text-sm font-medium">SMTP host
                    <input value={host} onChange={e => setHost(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="smtp.gmail.com" />
                  </label>
                  <label className="block text-sm font-medium">Port
                    <input value={port} onChange={e => setPort(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="465" />
                  </label>
                </div>
                <label className="block text-sm font-medium">Username
                  <input value={username} onChange={e => setUsername(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder={email || 'you@company.com'} autoComplete="off" />
                  <span className="mt-1 block text-[11px] text-muted-foreground">Leave blank if it is the same as the email address.</span>
                </label>
                <label className="block text-sm font-medium">Password or app password
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={cn(inputCls, 'mt-1.5')} autoComplete="new-password" />
                  <span className="mt-1 block text-[11px] text-muted-foreground">Use an app-specific password, not your normal account password.</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label className="col-span-2 block text-sm font-medium">IMAP host <span className="text-muted-foreground font-normal">(optional)</span>
                    <input value={imapHost} onChange={e => setImapHost(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="imap.gmail.com" />
                  </label>
                  <label className="block text-sm font-medium">Port
                    <input value={imapPort} onChange={e => setImapPort(e.target.value)} className={cn(inputCls, 'mt-1.5')} placeholder="993" />
                  </label>
                </div>
                <p className="text-[11px] text-muted-foreground">IMAP is needed to sync replies into the inbox. Without it, campaigns still send, but replies are not detected.</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[var(--cf-success)]" /> You will be redirected to {provider === 'gmail' ? 'Google' : 'Microsoft'} to approve access. ColdFox never sees your password.</p>
            )}
          </div>
        )}

        {step === 2 && provider && (
          <div className="text-center py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
              <Mail className="w-6 h-6 text-[var(--cf-success)]" />
            </div>
            <p className="font-semibold text-foreground">Ready to connect {email}</p>
            <p className="text-sm text-muted-foreground mt-1">Sending as <span className="text-foreground font-medium">{senderName}</span></p>
            <p className="text-sm text-muted-foreground mt-1">
              {provider === 'smtp'
                ? 'ColdFox tests the SMTP and IMAP connections before saving encrypted credentials.'
                : `You will be redirected to ${provider === 'gmail' ? 'Google' : 'Microsoft'} to approve access.`}
            </p>
          </div>
        )}

        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

        <div className="flex justify-between mt-6">
          <button onClick={() => (step === 0 ? onClose() : setStep(s => s - 1))} className="px-4 py-2 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 2 ? (
            <button onClick={next} className="px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">Continue</button>
          ) : (
            <button onClick={() => void finish()} disabled={busy} className="px-4 py-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50 disabled:opacity-60">
              {busy ? 'Connecting…' : 'Connect mailbox'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
