'use client';

import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import {
  ArrowRight, CheckCircle, Mail, Users, BarChart2,
  Zap, Shield, Brain, ChevronDown, ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { plans } from '@/lib/mock-data';

const features = [
  { icon: Brain, title: 'Lead import analysis', description: 'Upload CSV or XLSX. ColdFox maps columns and flags invalid emails, duplicates and missing fields before you send.' },
  { icon: Mail, title: 'AI email writer', description: 'Draft from lead fields with tone and length controls, then save the result as a reusable template.' },
  { icon: Zap, title: 'Sequences', description: 'Follow-up steps with delays that stop on reply, unsubscribe or hard bounce. Set sending windows and daily caps.' },
  { icon: Shield, title: 'Deliverability checks', description: 'Read your SPF, DKIM and DMARC records and review mailbox health before sending from your own domain.' },
  { icon: Users, title: 'CRM', description: 'Keep leads with notes, tags, status and follow-up dates. Conversation history sits next to each contact.' },
  { icon: BarChart2, title: 'Analytics', description: 'Review sends, replies and bounces per campaign and mailbox, then export the report as CSV.' },
];

const howItWorks = [
  { step: '01', title: 'Import leads', description: 'Upload CSV or XLSX. Column mapping and quality checks run before anything is saved.' },
  { step: '02', title: 'Write and sequence', description: 'Create templates and follow-up steps. Review the personalization fields before launch.' },
  { step: '03', title: 'Connect a mailbox', description: 'Connect Gmail, Microsoft Outlook, or SMTP and IMAP. ColdFox tests the connection before saving.' },
  { step: '04', title: 'Review replies', description: 'Replies arrive in the unified inbox. Archive them, assign them, or update the lead status.' },
];

const faqs = [
  { q: 'Does ColdFox guarantee inbox delivery?', a: 'No. Placement depends on your domain reputation, content and the filters of the receiving provider. ColdFox checks DNS records, tracks bounces and complaints, and shows sending health so you can keep to safer sending habits.' },
  { q: 'Can I connect my existing email account?', a: 'Yes. ColdFox connects to Gmail, Microsoft Outlook, and any SMTP or IMAP provider. Your emails are sent from your own mailboxes.' },
  { q: 'Is my contact data safe?', a: 'Your lead data stays in your workspace. It is not sold and not shared with third parties for advertising. You can export or delete it from Settings.' },
  { q: 'Does ColdFox handle unsubscribes?', a: 'Yes. ColdFox keeps a suppression list for unsubscribes, hard bounces and complaints. Suppressed contacts are excluded from later campaigns.' },
  { q: 'What counts as an email sent?', a: 'Each outbound email dispatched from a connected mailbox counts as one send. Follow-up emails in a sequence each count separately.' },
];

function ProductPreview() {
  return (
    <div className="neu-card-lg rounded-[20px] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
          <p className="text-[13px] font-medium text-foreground">Q4 pipeline, mid-market SaaS</p>
        </div>
        <span className="text-[12px] text-muted-foreground tabular-nums">412 sent · 38 replied</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-5">
        <div className="sm:col-span-2 space-y-3">
          <p className="text-[12px] font-medium text-muted-foreground">Campaigns</p>
          {[
            { name: 'Q4 pipeline, SaaS', state: 'Sending', live: true },
            { name: 'Agency founders, EU', state: 'Scheduled' },
            { name: 'RevOps re-engagement', state: 'Paused' },
          ].map(c => (
            <div key={c.name} className={cn('rounded-[10px] px-3 py-2.5', c.live ? 'neu-inset-sm' : 'border border-border')}>
              <p className="truncate text-[13px] text-foreground">{c.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                {c.live && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
                {c.state}
              </p>
            </div>
          ))}
          <div className="rounded-[10px] p-3 neu-inset-sm">
            <p className="text-[12px] text-muted-foreground">Daily sending</p>
            <p className="mt-1 text-[20px] font-medium text-foreground tabular-nums">86 / 120</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-input">
              <div className="h-full rounded-full bg-primary" style={{ width: '72%' }} />
            </div>
          </div>
        </div>

        <div className="sm:col-span-3 rounded-[12px] bg-[var(--raised)] p-4 shadow-[var(--shadow-raised-sm)]">
          <p className="text-[12px] font-medium text-muted-foreground">Reply</p>
          <p className="mt-1 text-[13px] font-medium text-foreground">Maya Okonkwo, VP Sales at Northwind Systems</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            We looked at the way your team runs sequences and I would like to see how the sending windows work for us.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Tuesday afternoon works on my side if that suits you.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-foreground">Reply</span>
            <span className="rounded-md border border-border px-2.5 py-1 text-[12px] text-muted-foreground">Assign</span>
            <span className="rounded-md border border-border px-2.5 py-1 text-[12px] text-muted-foreground">Interested</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      <section className="relative overflow-hidden px-6 pb-16 pt-28 sm:px-8 lg:pb-20 lg:pt-32">
        <div className="relative mx-auto max-w-[1600px]">
          <div className="grid-lines" aria-hidden="true" />
          <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <div className="mb-5 flex items-start gap-3">
              <span className="accent-tick" aria-hidden="true" />
              <p className="rounded-md neu-inset-sm px-2.5 py-1 text-[12px] font-medium text-accent-foreground">
                Cold email workspace
              </p>
            </div>
            <h1 className="text-[38px] font-semibold leading-[1.08] text-foreground sm:text-[44px] lg:text-[50px]">
              Cold email, CRM and inbox for teams that send from their own mailbox
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-[1.65] text-muted-foreground">
              Import leads from a spreadsheet, connect Gmail or SMTP, write the message, run the sequence and handle the replies. Suppression, bounce handling and deliverability checks are built in.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
                Create a free account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/features" className="inline-flex h-12 items-center justify-center rounded-[10px] bg-card px-6 text-sm font-medium text-foreground shadow-[var(--shadow-raised)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised-lg)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
                See what it does
              </Link>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground">
              {['500 emails a month on the free plan', 'Your own mailbox', 'Export your data at any time'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-accent-foreground" />
                  {t}
                </span>
              ))}
            </p>
          </div>

          <ProductPreview />
          </div>
        </div>
      </section>

      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />

      <section className="px-6 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1520px]">
          <div className="max-w-2xl">
            <h2 className="text-[32px] font-semibold text-foreground">What ColdFox does</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">From import to reply handling. Each tool has a clear input and output so you can check your work.</p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(f => (
              <div key={f.title} className="neu-card rounded-[16px] p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] neu-inset-sm">
                  <f.icon className="w-5 h-5 text-accent-foreground" />
                </div>
                <h3 className="text-[15px] font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />

      <section className="band-raised px-6 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-[1520px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-md neu-inset-sm px-2.5 py-1 text-[12px] font-medium text-accent-foreground">
              <Brain className="w-3.5 h-3.5" /> Import checks
            </p>
            <h2 className="text-[28px] font-semibold text-foreground">Check the list before you send</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">ColdFox checks for invalid emails, duplicates and missing fields after import. You review uncertain column mappings before confirming.</p>
            <ul className="mt-6 space-y-3">
              {['Column detection for CSV and XLSX', 'Duplicate contact detection', 'Missing field indicators', 'Invalid email warnings', 'Personalization field preview'].map(item => (
                <li key={item} className="flex items-center gap-3 text-[14px] text-foreground">
                  <CheckCircle className="w-4 h-4 shrink-0 text-accent-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="neu-card rounded-[16px] p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-foreground">Lead import review</h3>
              <span className="rounded-md bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">Checklist</span>
            </div>
            <ul className="mt-5 space-y-3">
              {['Columns mapped to CRM fields', 'Invalid emails flagged', 'Duplicates flagged', 'Missing data flagged', 'You confirm before saving'].map(item => (
                <li key={item} className="flex items-center gap-3 text-[14px] text-foreground">
                  <CheckCircle className="w-4 h-4 shrink-0 text-accent-foreground" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-[10px] p-4 neu-inset-sm">
              <p className="text-[13px] font-medium text-foreground">Review step</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">Fix flagged rows, then confirm. Nothing is saved until you confirm.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />

      <section className="band-raised px-6 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto grid max-w-[1520px] items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="neu-card rounded-[16px] p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent">
                <Mail className="w-3.5 h-3.5 text-accent-foreground" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">Email draft</p>
              <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">Template preview</span>
            </div>
            <div className="rounded-[10px] p-4 neu-inset-sm text-[14px] leading-relaxed text-foreground">
              <p className="mb-2 text-[12px] font-medium text-muted-foreground">Template fields: first name, company, job title</p>
              <p>Hi [first name],</p>
              <div className="h-3" />
              <p>Your template body appears here with lead fields filled in for each recipient.</p>
              <div className="h-3" />
              <p>Unsubscribe handling and suppression checks run before sending.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {['Plain text sending', 'Template versions', 'Suppression check'].map(t => (
                <span key={t} className="rounded-md bg-muted px-2.5 py-1 text-[12px] text-muted-foreground">{t}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-md neu-inset-sm px-2.5 py-1 text-[12px] font-medium text-accent-foreground">
              <Mail className="w-3.5 h-3.5" /> Email templates
            </p>
            <h2 className="text-[28px] font-semibold text-foreground">Templates you can edit</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Write in your own words. ColdFox fills lead fields per recipient and records template versions so you can review changes.</p>
            <ul className="mt-6 space-y-3">
              {['Personalization with any lead field', 'Tone and length controls', 'Subject line drafts', 'Template version history', 'Unsubscribe footer added at send time'].map(item => (
                <li key={item} className="flex items-center gap-3 text-[14px] text-foreground">
                  <CheckCircle className="w-4 h-4 shrink-0 text-accent-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />

      <section className="band-raised px-6 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-[1520px]">
          <h2 className="text-[32px] font-semibold text-foreground">How ColdFox works</h2>
          <p className="mt-3 text-[15px] text-muted-foreground">Four steps from list to inbox.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map(step => (
              <div key={step.step} className="neu-card rounded-[16px] p-6">
                <div className="mb-3 text-[26px] font-medium leading-none text-accent-foreground">{step.step}</div>
                <h3 className="text-[15px] font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />

      <section className="px-6 py-16 sm:px-8 lg:py-20" id="pricing">
        <div className="mx-auto max-w-[1520px]">
          <h2 className="text-[32px] font-semibold text-foreground">Pricing</h2>
          <p className="mt-3 max-w-xl text-[15px] text-muted-foreground">The free plan stays free. Paid plans add mailboxes, leads and higher sending limits.</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map(plan => {
              const highlight = plan.id === 'pro';
              return (
                <div key={plan.id} className={cn(
                  'flex flex-col rounded-[16px] p-6',
                  highlight ? 'neu-card-lg ring-1 ring-primary/40' : 'neu-card'
                )}>
                  <p className="mb-2 h-4 text-[12px] font-medium text-accent-foreground">{highlight ? 'Most used' : ''}</p>
                  <p className="text-[13px] font-medium text-muted-foreground">{plan.name}</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-[32px] font-medium leading-none text-foreground tabular-nums">${plan.price}</span>
                    <span className="text-[13px] text-muted-foreground">/mo</span>
                  </div>
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-[13px] text-foreground">
                        <CheckCircle className="w-4 h-4 shrink-0 text-accent-foreground" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className={cn(
                    'mt-6 block rounded-[10px] py-2.5 text-center text-sm font-medium transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)]',
                    highlight
                      ? 'bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]'
                      : 'bg-card text-foreground shadow-[var(--shadow-raised-sm)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]'
                  )}>
                    {plan.id === 'free' ? 'Create account' : plan.id === 'enterprise' ? 'Contact us' : 'Start free trial'}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />

      <section className="band-raised px-6 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-[28px] font-semibold text-foreground">Frequently asked questions</h2>
          <div className="mt-8 space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="overflow-hidden rounded-[16px] neu-card">
                <button
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span className="text-[14px] font-medium text-foreground">{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
                </button>
                {openFaq === i && (
                  <div className="border-t border-border px-5 pb-4 pt-3 text-[13px] leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />

      <section className="px-6 pb-24 sm:px-8">
        <div className="mx-auto max-w-[1520px]">
          <div className="neu-card-lg rounded-[20px] p-10 text-center sm:p-12">
            <h2 className="text-[28px] font-semibold text-foreground">Create your workspace</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">Import a CSV, connect a mailbox and send a first campaign. Export your data at any time.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
                Create a free account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-[10px] bg-card px-6 text-sm font-medium text-foreground shadow-[var(--shadow-raised)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised-lg)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
                View pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
