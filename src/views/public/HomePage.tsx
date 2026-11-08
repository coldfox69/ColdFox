'use client';

import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import {
  ArrowRight, CheckCircle, Mail, Users, BarChart2,
  Zap, Shield, Brain, Play,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const features = [
  { icon: Brain, title: 'Lead Import Analysis', description: 'Upload CSV or XLSX. ColdFox maps columns, flags invalid emails, duplicates, and missing fields before you send.', color: 'neu-inset-sm text-primary' },
  { icon: Mail, title: 'AI Email Writer', description: 'Generate emails from lead fields with tone and length controls. Save drafts as reusable templates.', color: 'neu-inset-sm text-primary' },
  { icon: Zap, title: 'Sequences', description: 'Build follow-up steps with delays that stop on reply, unsubscribe, or hard bounce. Set sending windows and daily caps.', color: 'neu-inset-sm text-primary' },
  { icon: Shield, title: 'Deliverability Checks', description: 'Check SPF, DKIM, and DMARC records and review mailbox health before sending from your own domain.', color: 'neu-inset-sm text-primary' },
  { icon: Users, title: 'CRM', description: 'Store leads with notes, tags, status, and follow-up dates. View conversation history per lead.', color: 'neu-inset-sm text-primary' },
  { icon: BarChart2, title: 'Analytics', description: 'Review sends, replies, and bounces per campaign and mailbox. Export reports as CSV.', color: 'neu-inset-sm text-primary' },
];

const howItWorks = [
  { step: '01', title: 'Import leads', description: 'Upload CSV or XLSX. Column mapping and quality checks run before anything is saved.' },
  { step: '02', title: 'Write and sequence', description: 'Create templates and follow-up steps. Review personalization fields before launch.' },
  { step: '03', title: 'Connect a mailbox', description: 'Connect Gmail, Microsoft Outlook, or SMTP/IMAP. ColdFox tests the connection before saving.' },
  { step: '04', title: 'Review replies', description: 'Replies land in the unified inbox. Archive, assign, or update lead status from there.' },
];

const faqs = [
  { q: 'Does ColdFox guarantee inbox delivery?', a: 'No. Placement depends on your domain reputation, content, and recipient provider filters. ColdFox checks DNS records, tracks bounces and complaints, and shows sending health so you can follow safer sending practices.' },
  { q: 'Can I connect my existing email account?', a: 'Yes. ColdFox connects to Gmail, Microsoft Outlook, or any SMTP/IMAP provider. Emails are sent from your own mailboxes.' },
  { q: 'Is my contact data safe?', a: 'Your lead data is stored in your workspace and is not sold or shared with third parties for advertising. You can export or delete data from Settings.' },
  { q: 'Does ColdFox handle unsubscribes?', a: 'Yes. ColdFox maintains a suppression list for unsubscribes, hard bounces, and complaints. Suppressed contacts are excluded from future campaigns.' },
  { q: 'What counts as an "email sent"?', a: 'Each outbound email dispatched from a connected mailbox counts as one send. Follow-up emails in a sequence each count separately.' },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      <section className="pt-28 sm:pt-32 pb-10">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl neu-inset-sm text-primary text-xs font-semibold mb-7">
              Cold email and CRM
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground mb-6">
              Cold email, CRM, and inbox in one place
            </h1>
            <p className="text-lg text-muted-foreground leading-[1.7] mb-10 max-w-2xl mx-auto">
              Import leads from CSV, connect Gmail or SMTP mailboxes, write emails with AI assistance, run follow-up sequences, and manage replies in a unified inbox. Suppression, bounce handling, and deliverability checks are built in.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-8 py-3.5 rounded-xl shadow-[var(--neu-elevated)] hover:brightness-[1.07] hover:-translate-y-0.5 active:shadow-[var(--neu-inset-sm)] active:translate-y-0 transition-all"
              >
                Create free account
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 neu-btn text-foreground font-semibold px-8 py-3.5 rounded-xl"
              >
                <Play className="w-4 h-4" /> View features
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px] text-muted-foreground">
              {['Free plan with 500 emails per month', 'Bring your own mailbox', 'Export your data anytime'].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 mx-auto max-w-5xl">
            <div className="neu-card-lg rounded-[1.75rem] p-7 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <p className="font-semibold text-foreground text-[15px]">Workspace overview</p>
                <span className="text-xs font-medium text-muted-foreground neu-inset-sm px-2.5 py-1 rounded-lg">Interface view</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-5 text-left">
                {[
                  { title: 'Leads', desc: 'Import, map columns, and fix quality issues before sending.' },
                  { title: 'Campaigns', desc: 'Sequences with sending windows, daily caps, and stop rules.' },
                  { title: 'Inbox', desc: 'Replies, assignments, and lead status updates in one list.' },
                ].map(item => (
                  <div key={item.title} className="neu-card-sm rounded-2xl p-5">
                    <p className="font-semibold text-foreground text-[15px]">{item.title}</p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-5">Numbers appear only after you import leads and send campaigns. This view shows the sections you will use.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">What ColdFox does</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto leading-relaxed">From import to reply handling. Each tool has a clear input and output so you can check your work.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="neu-card rounded-2xl p-6">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4', f.color)}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-[15px]">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary neu-inset-sm px-3.5 py-1.5 rounded-xl mb-4">
                <Brain className="w-3.5 h-3.5" /> Import checks
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight">Check your list before you send</h2>
              <p className="text-muted-foreground leading-[1.7] mb-6">ColdFox checks for invalid emails, duplicates, and missing fields after import. You review uncertain column mappings before confirming.</p>
              <ul className="space-y-3">
                {['Column detection for CSV and XLSX', 'Duplicate contact detection', 'Missing field indicators', 'Invalid email warnings', 'Personalization field preview'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-[15px]">
                    <CheckCircle className="w-[18px] h-[18px] text-primary flex-shrink-0" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="neu-card rounded-3xl p-7">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground text-[15px]">Lead import review</p>
                <span className="text-xs font-medium text-muted-foreground neu-inset-sm px-2.5 py-1 rounded-lg">Checklist</span>
              </div>
              <ul className="mt-5 space-y-3">
                {['Columns mapped to CRM fields', 'Invalid emails flagged', 'Duplicates flagged', 'Missing data flagged', 'You confirm before saving'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 p-4 neu-inset-sm rounded-xl">
                <p className="text-xs font-semibold text-foreground">Review step</p>
                <p className="text-xs text-muted-foreground mt-0.5">Fix flagged rows, then confirm. Nothing is saved until you confirm.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div className="neu-card rounded-3xl p-7">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-[var(--neu-elevated-sm)]">
                  <Mail className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <p className="font-semibold text-foreground text-[15px]">Email draft view</p>
                <span className="ml-auto text-xs neu-inset-sm text-muted-foreground px-2.5 py-1 rounded-lg">Template preview</span>
              </div>
              <div className="neu-inset-sm rounded-xl p-4 text-sm text-foreground leading-relaxed">
                <p className="font-medium text-muted-foreground text-xs mb-2">Template fields: first name, company, job title</p>
                <p>Hi [first name],</p>
                <div className="h-3" />
                <p>Your template body appears here with lead fields filled in for each recipient.</p>
                <div className="h-3" />
                <p>Unsubscribe handling and suppression checks run before sending.</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 neu-inset-sm text-muted-foreground rounded-lg font-medium">Plain text sending</span>
                <span className="px-2.5 py-1 neu-inset-sm text-muted-foreground rounded-lg font-medium">Template versions</span>
                <span className="px-2.5 py-1 neu-inset-sm text-muted-foreground rounded-lg font-medium">Suppression check</span>
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary neu-inset-sm px-3.5 py-1.5 rounded-xl mb-4">
                <Mail className="w-3.5 h-3.5" /> Email templates
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4 tracking-tight">Templates you can edit</h2>
              <p className="text-muted-foreground leading-[1.7] mb-6">Write in your own words. ColdFox fills lead fields per recipient and records template versions so you can review changes.</p>
              <ul className="space-y-3">
                {['Personalization with any lead field', 'Tone and length controls', 'Subject line drafts', 'Template version history', 'Unsubscribe footer added at send time'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-[15px]">
                    <CheckCircle className="w-[18px] h-[18px] text-primary flex-shrink-0" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">How ColdFox works</h2>
            <p className="text-muted-foreground mt-3">Four steps from list to inbox.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map(step => (
              <div key={step.step} className="neu-card rounded-2xl p-6">
                <div className="text-3xl font-extrabold text-primary mb-3 tracking-tight">{step.step}</div>
                <h3 className="font-semibold text-foreground mb-2 text-[15px]">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16" id="pricing">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Pricing</h2>
            <p className="text-muted-foreground mt-3">Free plan included. Paid plans add mailboxes, leads, and higher sending limits.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Free', price: '$0', period: '/month', features: ['1 mailbox', '100 leads', '500 emails per month', 'Basic templates', 'Community support'], cta: 'Create free account', highlight: false },
              { name: 'Starter', price: '$49', period: '/month', features: ['3 mailboxes', '2,500 leads', '10,000 emails per month', 'AI email writer', 'Unified inbox', 'Email support'], cta: 'Create free account', highlight: false },
              { name: 'Growth', price: '$99', period: '/month', features: ['10 mailboxes', '10,000 leads', '50,000 emails per month', 'Advanced AI', 'Analytics', 'Automations', 'Priority support'], cta: 'Create free account', highlight: true },
              { name: 'Agency', price: '$249', period: '/month', features: ['Higher limits', 'Custom AI models', 'Dedicated support', 'Custom integrations', 'SSO on request'], cta: 'Contact us', highlight: false },
            ].map(plan => (
              <div key={plan.name} className={cn(
                'rounded-2xl p-6 flex flex-col',
                plan.highlight ? 'bg-slate-900 text-white relative shadow-[var(--neu-elevated)]' : 'neu-card'
              )}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-lg">
                    Most used
                  </div>
                )}
                <div>
                  <p className={cn('text-sm font-semibold mb-1', plan.highlight ? 'text-blue-200' : 'text-muted-foreground')}>{plan.name}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className={cn('text-3xl font-bold', plan.highlight ? 'text-white' : 'text-foreground')}>{plan.price}</span>
                    <span className={cn('text-sm', plan.highlight ? 'text-blue-200' : 'text-muted-foreground')}>{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={cn('w-4 h-4 flex-shrink-0', plan.highlight ? 'text-blue-200' : 'text-primary')} />
                      <span className={plan.highlight ? 'text-blue-100' : 'text-foreground'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={cn(
                    'mt-6 block text-center py-2.5 rounded-xl text-sm font-semibold transition-all',
                    plan.highlight
                      ? 'bg-white text-blue-900 hover:bg-blue-50'
                      : 'bg-primary text-primary-foreground shadow-[var(--neu-elevated-sm)] hover:brightness-[1.07] active:shadow-[var(--neu-inset-sm)]'
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 sm:px-8">
          <h2 className="text-3xl font-bold text-foreground text-center mb-10 tracking-tight">Frequently asked questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="neu-card rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-foreground text-[15px]">{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 sm:px-8">
          <div className="bg-slate-900 rounded-[1.75rem] p-10 sm:p-12 text-center text-white shadow-[var(--neu-elevated-lg)]">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">Create your workspace</h2>
            <p className="text-blue-200 mb-8 max-w-xl mx-auto leading-relaxed">Import a CSV, connect a mailbox, and send a first campaign. Export your data at any time.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="bg-white text-blue-900 font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-50 transition-all shadow-[var(--neu-elevated-sm)] inline-flex items-center gap-2">
                Create free account <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/pricing" className="border border-blue-400 text-white font-semibold px-8 py-3.5 rounded-xl hover:bg-blue-900 transition-colors">
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
