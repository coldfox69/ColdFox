import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MailboxVM } from '@/lib/view-models';

export type SendingSettings = {
  mailboxId: string;
  dailyCap: number;
  windowStart: string;
  windowEnd: string;
  timezone: string;
  intervalMinutes: number;
  weekdays: number[];
  followUpDays: number;
  pauseOnReply: boolean;
  mode: 'now' | 'schedule';
  startDate: string;
  startTime: string;
};

export const defaultSending: SendingSettings = {
  mailboxId: '',
  dailyCap: 80,
  windowStart: '09:00',
  windowEnd: '17:00',
  timezone: 'UTC',
  intervalMinutes: 4,
  weekdays: [1, 2, 3, 4, 5],
  followUpDays: 0,
  pauseOnReply: true,
  mode: 'schedule',
  startDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  startTime: '09:00',
};

const days = [
  { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 }, { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 }, { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
];

const timezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Madrid',
  'Africa/Cairo', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka',
  'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

const inputCls = 'w-full px-3.5 py-2.5 rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

export function validateSending(
  settings: SendingSettings,
  validLeadCount: number,
  mailboxes: MailboxVM[],
): { level: 'error' | 'warning'; message: string }[] {
  const issues: { level: 'error' | 'warning'; message: string }[] = [];
  const mailbox = mailboxes.find((item) => item.id === settings.mailboxId);
  if (!mailbox) issues.push({ level: 'error', message: 'Select a sending mailbox.' });
  if (mailbox && mailbox.status !== 'connected') {
    issues.push({ level: 'error', message: `${mailbox.email} is not connected. Reconnect it or choose another mailbox.` });
  }
  if (mailbox && settings.dailyCap > mailbox.dailyLimit) {
    issues.push({ level: 'error', message: `Daily cap is above this mailbox's limit of ${mailbox.dailyLimit}.` });
  }
  if (settings.dailyCap > 150) {
    issues.push({ level: 'warning', message: 'Caps above 150 a day can harm sender reputation. Consider ramping up gradually.' });
  }
  if (settings.weekdays.length === 0) issues.push({ level: 'error', message: 'Select at least one sending day.' });
  if (settings.windowStart >= settings.windowEnd) issues.push({ level: 'error', message: 'The sending window must end after it starts.' });
  if (settings.followUpDays > 14) issues.push({ level: 'warning', message: 'Follow-ups later than 14 days rarely add value.' });
  if (validLeadCount === 0) issues.push({ level: 'error', message: 'No valid leads to send to. Import leads first.' });
  if (settings.mode === 'schedule' && !settings.startDate) issues.push({ level: 'error', message: 'Choose a start date.' });
  return issues;
}

export function SendingSettingsStep({
  value,
  onChange,
  mailboxes,
}: {
  value: SendingSettings;
  onChange: (value: SendingSettings) => void;
  mailboxes: MailboxVM[];
}) {
  const set = <K extends keyof SendingSettings>(key: K, next: SendingSettings[K]) => onChange({ ...value, [key]: next });
  const toggleDay = (day: number) =>
    set('weekdays', value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day]);
  const selected = mailboxes.find((item) => item.id === value.mailboxId);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <Section title="Sending mailbox">
          {mailboxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No mailboxes are connected. Add one under Mailboxes before launching a campaign.
            </p>
          ) : (
            <>
              <select aria-label="Sending mailbox" className={inputCls} value={value.mailboxId} onChange={(event) => set('mailboxId', event.target.value)}>
                <option value="">Select a mailbox</option>
                {mailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.email}{mailbox.status !== 'connected' ? ' (needs attention)' : ''} · {mailbox.dailyLimit}/day
                  </option>
                ))}
              </select>
              {selected && (
                <p className="text-[12px] text-muted-foreground mt-2">
                  {selected.sentToday.toLocaleString()} sent today · reputation {selected.reputation} · {selected.status}
                </p>
              )}
            </>
          )}
        </Section>

        <Section title={`Daily sending cap: ${value.dailyCap} emails`}>
          <input type="range" min={10} max={Math.max(300, selected?.dailyLimit ?? 300)} step={5} value={value.dailyCap}
            onChange={(event) => set('dailyCap', Number(event.target.value))} aria-label="Daily sending cap" className="w-full accent-[var(--primary)]" />
          <div className="flex justify-between text-[12px] text-muted-foreground"><span>10</span><span>150 recommended max</span><span>{Math.max(300, selected?.dailyLimit ?? 300)}</span></div>
        </Section>

        <Section title="Sending time window">
          <div className="grid grid-cols-2 gap-3">
            <input type="time" aria-label="Window start" className={inputCls} value={value.windowStart} onChange={(event) => set('windowStart', event.target.value)} />
            <input type="time" aria-label="Window end" className={inputCls} value={value.windowEnd} onChange={(event) => set('windowEnd', event.target.value)} />
          </div>
          <label className="block text-[12px] text-muted-foreground mt-3">
            Timezone
            <select aria-label="Sending timezone" className={cn(inputCls, 'mt-1')} value={value.timezone} onChange={(event) => set('timezone', event.target.value)}>
              {timezones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </label>
        </Section>

        <Section title={`Sending interval: ${value.intervalMinutes} min between emails`}>
          <input type="range" min={1} max={30} value={value.intervalMinutes} onChange={(event) => set('intervalMinutes', Number(event.target.value))} aria-label="Sending interval" className="w-full accent-[var(--primary)]" />
          <p className="text-[12px] text-muted-foreground mt-2">Stored with the campaign for reference; the worker spaces sends conservatively.</p>
        </Section>

        <Section title="Sending days">
          <div className="flex flex-wrap gap-2">
            {days.map((day) => (
              <button key={day.value} type="button" aria-pressed={value.weekdays.includes(day.value)} onClick={() => toggleDay(day.value)}
                className={cn('w-12 py-2 rounded-lg text-[12px] font-medium border transition-colors',
                  value.weekdays.includes(day.value) ? 'bg-primary text-primary-foreground border-transparent' : 'border-border text-muted-foreground hover:bg-muted')}>
                {day.label}
              </button>
            ))}
          </div>
        </Section>
      </div>

      <div className="space-y-5">
        <Section title="Follow-up">
          <label className="text-[12px] text-muted-foreground">
            Send a follow-up after (days, 0 disables)
            <input type="number" min={0} max={30} className={cn(inputCls, 'mt-1')} value={value.followUpDays}
              onChange={(event) => set('followUpDays', Number(event.target.value))} />
          </label>
          <p className="text-[12px] text-muted-foreground mt-2">Follow-ups stop automatically on reply, unsubscribe, or hard bounce.</p>
        </Section>

        <Section title="Pause conditions">
          <label className="flex items-center justify-between gap-3 py-2 text-sm cursor-pointer">
            <span className="text-foreground">Stop the sequence when the contact replies</span>
            <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={value.pauseOnReply} onChange={(event) => set('pauseOnReply', event.target.checked)} />
          </label>
          <p className="text-[12px] text-muted-foreground">Hard bounces and complaints are always suppressed and never retried.</p>
        </Section>

        <Section title="When to send">
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
            {([['now', 'Send now'], ['schedule', 'Schedule']] as const).map(([mode, label]) => (
              <button key={mode} type="button" aria-pressed={value.mode === mode} onClick={() => set('mode', mode)}
                className={cn('py-2 rounded-lg text-sm font-medium', value.mode === mode ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>{label}</button>
            ))}
          </div>
          {value.mode === 'schedule' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <input type="date" aria-label="Start date" className={inputCls} value={value.startDate} onChange={(event) => set('startDate', event.target.value)} />
              <input type="time" aria-label="Start time" className={inputCls} value={value.startTime} onChange={(event) => set('startTime', event.target.value)} />
            </div>
          )}
          <p className="text-[12px] text-muted-foreground mt-2">Scheduling uses your browser&apos;s local timezone.</p>
        </Section>
      </div>
    </div>
  );
}

export function ValidationList({ issues }: { issues: { level: 'error' | 'warning'; message: string }[] }) {
  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--cf-success)]">
        <CheckCircle2 className="w-4 h-4" /> Everything looks good. You can launch this campaign.
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {issues.map((issue, index) => (
        <li key={index} className={cn('flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm',
          issue.level === 'error' ? 'neu-inset-sm text-muted-foreground' : 'neu-inset-sm text-muted-foreground')}>
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {issue.message}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="neu-card rounded-[16px] p-5">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}
