import { CalendarClock, Send, Users, Mail, Clock, ShieldCheck, Repeat } from 'lucide-react';
import { ValidationList, type SendingSettings } from './SendingSettingsStep';
import type { MailboxVM } from '@/lib/view-models';

export type ReviewSummary = {
  name: string;
  objective: string;
  leadCount: number;
  subject: string;
  sending: SendingSettings;
};

const DAY_LABELS: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

export function CampaignReview({
  summary,
  issues,
  mailboxes = [],
}: {
  summary: ReviewSummary;
  issues: { level: 'error' | 'warning'; message: string }[];
  mailboxes?: MailboxVM[];
}) {
  const mailbox = mailboxes.find((item) => item.id === summary.sending.mailboxId);
  const settings = summary.sending;
  const blocked = issues.some((issue) => issue.level === 'error');
  const days = [...settings.weekdays].sort((a, b) => a - b).map((day) => DAY_LABELS[day]).join(', ');

  const items = [
    { icon: Users, label: 'Recipients', value: `${summary.leadCount.toLocaleString()} imported leads` },
    { icon: Mail, label: 'Sending mailbox', value: mailbox?.email ?? 'Not selected' },
    { icon: Send, label: 'Subject', value: summary.subject || 'No subject yet' },
    { icon: Clock, label: 'Window and days', value: `${settings.windowStart} to ${settings.windowEnd} (${settings.timezone}), ${days || 'no days'}` },
    { icon: ShieldCheck, label: 'Daily cap', value: `${settings.dailyCap} emails per day, ${settings.intervalMinutes} min apart` },
    { icon: Repeat, label: 'Follow-up', value: settings.followUpDays > 0 ? `After ${settings.followUpDays} day${settings.followUpDays === 1 ? '' : 's'}` : 'No follow-up' },
    { icon: CalendarClock, label: 'Start', value: settings.mode === 'now' ? 'Send immediately' : `${settings.startDate} at ${settings.startTime}` },
  ];

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 neu-card rounded-2xl p-6">
        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">Campaign summary</p>
        <h2 className="text-xl font-bold text-foreground mb-1">{summary.name || 'Untitled campaign'}</h2>
        <p className="text-sm text-muted-foreground mb-6">{summary.objective || 'No objective set'}</p>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
          {items.map((item) => (
            <div key={item.label} className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground"><item.icon className="w-4 h-4" /></div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="text-sm font-medium text-foreground break-words">{item.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
      <div className="lg:col-span-2 space-y-4">
        <div className="neu-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-3">Pre-launch checks</h3>
          <ValidationList issues={issues} />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed px-1">
          ColdFox helps you send with good practices, but it cannot guarantee inbox placement. Only contact people with a legitimate reason to reach out, and honor every unsubscribe request.
        </p>
        <p className={blocked ? 'text-xs text-red-600 dark:text-red-400' : 'hidden'}>Resolve the errors above before launching.</p>
      </div>
    </div>
  );
}
