import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Brain, Zap, Shield, Users, BarChart2, Inbox, Check } from 'lucide-react';

const features = [
  {
    category: 'Lead management',
    icon: Users,
    items: [
      { title: 'CSV and XLSX import', desc: 'Upload a lead spreadsheet. Column detection and mapping run as you upload.' },
      { title: 'Import analysis', desc: 'Data quality checks for invalid emails, missing fields, duplicates and enrichment gaps.' },
      { title: 'CRM pipeline', desc: 'Track leads through stages, with notes, tags and next follow-up dates.' },
      { title: 'Lead profile', desc: 'Contact history, campaign participation, conversation threads and an activity timeline.' },
    ],
  },
  {
    category: 'Email and AI writing',
    icon: Brain,
    items: [
      { title: 'AI email writer', desc: 'Draft from lead fields with tone and length controls, then save the result as a template.' },
      { title: 'Template library', desc: 'Personal and shared templates with categories, search and version history.' },
      { title: 'Subject line drafts', desc: 'Several subject variants generated from the message you wrote.' },
      { title: 'Optimizer', desc: 'Before and after comparison with clarity notes and risk flags on the wording.' },
    ],
  },
  {
    category: 'Campaign automation',
    icon: Zap,
    items: [
      { title: 'Multi-step sequences', desc: 'Follow-up steps with delays that stop on reply, unsubscribe or hard bounce.' },
      { title: 'Template rotation', desc: 'Alternate message variants across a sequence for content testing and natural variation.' },
      { title: 'Sending schedules', desc: 'Sending windows, timezone, weekday selection and a daily cap per mailbox.' },
      { title: 'Workflow builder', desc: 'Automation flows with triggers, delays, branches and conditions.' },
    ],
  },
  {
    category: 'Mailbox and deliverability',
    icon: Shield,
    items: [
      { title: 'Gmail and Outlook', desc: 'Connect your own mailboxes over OAuth. Mail leaves from your domain, not shared servers.' },
      { title: 'SMTP and IMAP', desc: 'Connect any provider with standard SMTP or IMAP credentials.' },
      { title: 'Deliverability checks', desc: 'Read SPF, DKIM and DMARC records with step-by-step DNS guidance.' },
      { title: 'Bounce and complaint tracking', desc: 'Hard bounces and complaints are recorded and the contact is suppressed.' },
    ],
  },
  {
    category: 'Inbox and conversations',
    icon: Inbox,
    items: [
      { title: 'Unified inbox', desc: 'Replies from every campaign in one list, with a thread view beside the lead context.' },
      { title: 'Conversation threading', desc: 'Full thread history with the lead panel and the campaign that started it.' },
      { title: 'Internal notes', desc: 'Private notes on a conversation so the team can hand over context.' },
      { title: 'Reply actions', desc: 'Archive, assign or update the lead status without leaving the thread.' },
    ],
  },
  {
    category: 'Analytics and reporting',
    icon: BarChart2,
    items: [
      { title: 'Campaign analytics', desc: 'Delivery, reply and bounce rates per campaign, with a date range filter.' },
      { title: 'Mailbox performance', desc: 'Sending stats and health per mailbox.' },
      { title: 'Report export', desc: 'Download the analytics report as CSV for your own analysis.' },
      { title: 'Suppression reports', desc: 'Full visibility into unsubscribes, bounces and complaints.' },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <section className="band-raised">
        <div className="mx-auto max-w-[1600px] px-6 pb-12 pt-28 sm:px-8 lg:pt-32">
          <div className="accent-rule-top max-w-2xl pt-7">
            <h1 className="text-[36px] font-semibold text-foreground">What the workspace covers</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Import, templates, sequences, inbox, and deliverability checks, all in one place.</p>
          </div>
        </div>
      </section>
      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />
      <section className="px-6 py-14 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-[1520px]">
          <div className="space-y-14">
            {features.map(section => (
              <div key={section.category}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] neu-inset-sm">
                    <section.icon className="w-[18px] h-[18px] text-accent-foreground" />
                  </div>
                  <h2 className="text-[18px] font-semibold text-foreground">{section.category}</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {section.items.map(item => (
                    <div key={item.title} className="neu-card rounded-[16px] p-5">
                      <div className="mb-2 flex items-start gap-2">
                        <Check className="mt-0.5 w-4 h-4 shrink-0 text-accent-foreground" />
                        <h3 className="text-[14px] font-medium text-foreground">{item.title}</h3>
                      </div>
                      <p className="pl-6 text-[13px] leading-relaxed text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="neu-card-lg mt-16 rounded-[20px] p-10 text-center">
            <h2 className="text-[24px] font-semibold text-foreground">Start with the free plan</h2>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">No credit card needed to create an account.</p>
            <Link href="/signup" className="mt-6 inline-flex h-11 items-center justify-center rounded-[10px] bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
              Create a free account
            </Link>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
