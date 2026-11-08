'use client';

import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import {
  Sparkles, ArrowRight, CheckCircle, Mail, Users, BarChart2,
  Zap, Shield, Brain, Play, Star, ChevronDown, ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { analyticsData } from '@/lib/mock-data';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const features = [
  { icon: Brain, title: 'AI Lead Intelligence', description: 'Automatically analyze imported lead spreadsheets. ColdFox identifies patterns, gaps, and enrichment opportunities.', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
  { icon: Mail, title: 'AI Email Writer', description: 'Generate hyper-personalized emails using lead data. Adjust tone, length, and messaging style with one click.', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' },
  { icon: Zap, title: 'Campaign Automation', description: 'Set up intelligent follow-up sequences that react to replies, bounces, and engagement — automatically.', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' },
  { icon: Shield, title: 'Deliverability Center', description: 'Monitor SPF, DKIM, DMARC, and sending health. Get actionable guidance to protect your domain reputation.', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' },
  { icon: Users, title: 'Built-in CRM', description: 'Track every lead through the sales journey. View conversation history, notes, tags, and next follow-up dates.', color: 'text-rose-500 bg-rose-50 dark:bg-rose-900/30' },
  { icon: BarChart2, title: 'Analytics & Reporting', description: 'Track campaign performance, mailbox health, and reply rates. Export reports to share with your team.', color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-900/30' },
];

const howItWorks = [
  { step: '01', title: 'Import Your Leads', description: 'Upload a CSV or paste leads manually. ColdFox maps columns and runs AI analysis to check quality.' },
  { step: '02', title: 'Write With AI', description: 'Use the AI Email Writer to generate personalized emails. Add follow-up sequences with smart delays.' },
  { step: '03', title: 'Launch & Monitor', description: 'Connect your mailbox, schedule your campaign, and watch replies land in the Unified Inbox.' },
  { step: '04', title: 'Manage & Grow', description: 'Move interested leads into your CRM pipeline. Track performance and optimize with analytics.' },
];

const testimonials = [
  { name: 'Jordan Miles', role: 'Head of Sales', company: 'DataStack', avatar: 'JM', text: 'ColdFox completely transformed our outbound process. We\'re booking 3x more meetings with half the manual effort. The AI personalization is genuinely impressive. [Sample testimonial — demo data]' },
  { name: 'Priya Anand', role: 'Founder', company: 'LaunchVelocity', avatar: 'PA', text: 'I\'ve tried every cold email tool out there. ColdFox is the first one that actually feels like it was built for modern sales teams. Clean, fast, and smart. [Sample testimonial — demo data]' },
  { name: 'Chris Nakamura', role: 'Marketing Director', company: 'BrightFunnel', avatar: 'CN', text: 'The deliverability features alone are worth the subscription. Our domain reputation has never been better and open rates are up 40% since switching. [Sample testimonial — demo data]' },
];

const faqs = [
  { q: 'Does ColdFox guarantee inbox delivery?', a: 'No tool can guarantee inbox delivery — that depends on your domain reputation, content quality, and recipient provider filters. ColdFox helps you optimize your content and maintain a healthy sending infrastructure, but placement is ultimately determined by email providers.' },
  { q: 'Can I connect my existing email account?', a: 'Yes. ColdFox connects to Gmail, Microsoft Outlook, and any SMTP/IMAP provider. Your emails are sent from your own mailboxes, not shared infrastructure.' },
  { q: 'Is my contact data safe?', a: 'Absolutely. Your lead data is stored securely and never shared or sold. You can export or delete your data at any time.' },
  { q: 'Does ColdFox handle unsubscribes?', a: 'Yes. ColdFox maintains a suppression list for unsubscribes, hard bounces, and complaints. Suppressed contacts are automatically excluded from future campaigns.' },
  { q: 'What counts as an "email sent"?', a: 'Each outbound email dispatched from a connected mailbox counts as one send. Follow-up emails in a sequence each count separately.' },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Cold Email Outreach
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] mb-6">
              Cold outreach that
              <span className="text-gradient block">actually converts</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
              ColdFox combines AI lead analysis, personalized email generation, and smart automation to help sales teams book more meetings — without burning your domain.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 gradient-blue text-white font-semibold px-8 py-3.5 rounded-2xl hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/25"
              >
                Start Free — No Credit Card
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center gap-2 text-foreground font-semibold px-8 py-3.5 rounded-2xl border border-border hover:bg-muted transition-colors"
              >
                <Play className="w-4 h-4" /> Explore Features
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {['No credit card required', 'Free plan available', 'Cancel anytime'].map(t => (
                <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="mt-16 relative mx-auto max-w-5xl">
            <div className="neu-card rounded-3xl overflow-hidden border border-border shadow-2xl">
              {/* Mock browser bar */}
              <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <div className="flex-1 mx-4 bg-background rounded-lg px-3 py-1 text-xs text-muted-foreground text-center">app.coldfox.io/overview</div>
              </div>
              {/* Dashboard preview */}
              <div className="bg-background p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Emails Sent', value: '89,420', change: '+12%', color: 'text-blue-500' },
                    { label: 'Replies', value: '6,740', change: '+18%', color: 'text-emerald-500' },
                    { label: 'Active Campaigns', value: '4', change: '2 scheduled', color: 'text-amber-500' },
                    { label: 'Sending Health', value: '94%', change: 'Excellent', color: 'text-purple-500' },
                  ].map(stat => (
                    <div key={stat.label} className="neu-card rounded-2xl p-4">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className={cn('text-xl font-bold mt-1', stat.color)}>{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.change}</p>
                    </div>
                  ))}
                </div>
                <div className="neu-card rounded-2xl p-4">
                  <p className="text-sm font-semibold text-foreground mb-3">Campaign Performance (Sample Data)</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analyticsData.chartData}>
                        <defs>
                          <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorReplied" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="url(#colorSent)" strokeWidth={2} name="Sent" />
                        <Area type="monotone" dataKey="replied" stroke="#10b981" fill="url(#colorReplied)" strokeWidth={2} name="Replied" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="py-16 border-y border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground mb-8 font-medium">Sample placeholder — trusted by forward-thinking sales teams</p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16 opacity-50">
            {['TechFlow', 'GrowthLab', 'DataWise AI', 'CloudOps', 'BrandCraft', 'ScaleX'].map(name => (
              <span key={name} className="text-lg font-bold text-muted-foreground">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Everything your outreach needs</h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">From lead import to reply management — ColdFox covers the entire cold outreach workflow in one platform.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="neu-card rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4', f.color)}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Lead Intelligence showcase */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full mb-4">
                <Brain className="w-3.5 h-3.5" /> AI Lead Intelligence
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">Upload a spreadsheet. Get instant insights.</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">ColdFox scans your imported leads for missing fields, invalid emails, duplicate contacts, and low-quality data — so you can fix issues before launching a campaign.</p>
              <ul className="space-y-3">
                {['Automatic column detection and mapping', 'Duplicate contact detection', 'Missing field indicators', 'Invalid email warnings', 'AI-suggested personalization variables'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="neu-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground text-sm">Lead Import Analysis</p>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">Sample data</span>
              </div>
              {[
                { label: 'Total rows detected', value: '1,240', color: 'text-foreground' },
                { label: 'Valid emails', value: '1,187', color: 'text-emerald-600' },
                { label: 'Invalid emails', value: '18', color: 'text-red-500' },
                { label: 'Duplicates found', value: '35', color: 'text-amber-600' },
                { label: 'Missing first name', value: '47', color: 'text-amber-600' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={cn('text-sm font-semibold', row.color)}>{row.value}</span>
                </div>
              ))}
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">AI Recommendation</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Fix 53 contacts with missing data before launching to maximize response rates.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Email Writer showcase */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 neu-card rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg gradient-blue flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="font-semibold text-foreground text-sm">AI Email Writer</p>
                <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">Sample output</span>
              </div>
              <div className="bg-muted rounded-xl p-4 text-sm text-foreground leading-relaxed">
                <p className="font-medium text-muted-foreground text-xs mb-2">Generated for: Sarah Chen, VP of Sales at TechFlow</p>
                <p>Hi Sarah,</p>
                <br />
                <p>I noticed TechFlow recently expanded its sales team in the APAC region — congrats on the growth!</p>
                <br />
                <p>At ColdFox, we help sales leaders like yourself automate the outbound process without losing the personal touch that converts prospects into meetings.</p>
                <br />
                <p>Would a 15-minute call this week make sense? I'd love to show you how teams like yours are booking 40% more meetings.</p>
                <br />
                <p>Best,<br />Alex</p>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-medium">Clarity: High</span>
                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium">Tone: Professional</span>
                <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium">Length: Optimal</span>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full mb-4">
                <Wand2 className="w-3.5 h-3.5" /> AI Email Writer
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">Personalized emails in seconds, not hours.</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">The AI Email Writer uses your lead data to generate hyper-personalized messages that feel human — because great outreach is about relevance, not volume.</p>
              <ul className="space-y-3">
                {['Personalize with any lead field', 'Multiple tone options', 'Subject line generator', 'Spam-risk analysis', 'Save and reuse as templates'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">How ColdFox works</h2>
            <p className="text-muted-foreground mt-3">From zero to booked meetings in four steps.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step, i) => (
              <div key={step.step} className="relative">
                {i < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-border z-0 -translate-x-1/2" />
                )}
                <div className="neu-card rounded-2xl p-6 relative z-10">
                  <div className="text-3xl font-black text-blue-500/20 mb-3">{step.step}</div>
                  <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24" id="pricing">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Simple, transparent pricing</h2>
            <p className="text-muted-foreground mt-3">Start free. Upgrade when you're ready to scale.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Free', price: '$0', period: '/month', features: ['1 mailbox', '100 leads', '500 emails/mo', 'Basic templates', 'Community support'], cta: 'Start Free', highlight: false },
              { name: 'Starter', price: '$49', period: '/month', features: ['3 mailboxes', '2,500 leads', '10,000 emails/mo', 'AI email writer', 'Unified inbox', 'Email support'], cta: 'Start Free Trial', highlight: false },
              { name: 'Pro', price: '$99', period: '/month', features: ['10 mailboxes', '10,000 leads', '50,000 emails/mo', 'Advanced AI', 'Analytics', 'Automations', 'Priority support'], cta: 'Start Free Trial', highlight: true },
              { name: 'Enterprise', price: '$249', period: '/month', features: ['Unlimited everything', 'Custom AI models', 'Dedicated CSM', 'SLA guarantee', 'Custom integrations', 'SSO/SAML'], cta: 'Contact Sales', highlight: false },
            ].map(plan => (
              <div key={plan.name} className={cn(
                'rounded-2xl p-6 flex flex-col',
                plan.highlight ? 'gradient-navy text-white shadow-xl shadow-blue-900/30 relative' : 'neu-card'
              )}>
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}
                <div>
                  <p className={cn('text-sm font-semibold mb-1', plan.highlight ? 'text-blue-300' : 'text-muted-foreground')}>{plan.name}</p>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className={cn('text-3xl font-black', plan.highlight ? 'text-white' : 'text-foreground')}>{plan.price}</span>
                    <span className={cn('text-sm', plan.highlight ? 'text-blue-300' : 'text-muted-foreground')}>{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={cn('w-4 h-4 flex-shrink-0', plan.highlight ? 'text-blue-300' : 'text-emerald-500')} />
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
                      : 'gradient-blue text-white hover:opacity-90'
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-6">Sample pricing for demonstration — not a real commercial offer.</p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">What our customers say</h2>
            <p className="text-muted-foreground mt-2 text-sm">Sample testimonials — for demonstration purposes only.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map(t => (
              <div key={t.name} className="neu-card rounded-2xl p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-sm text-foreground leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full gradient-blue flex items-center justify-center text-white text-sm font-bold">{t.avatar}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role} at {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground text-center mb-12">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="neu-card rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-foreground text-sm">{faq.q}</span>
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

      {/* Final CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="gradient-navy rounded-3xl p-12 text-center text-white relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-4" />
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to transform your outreach?</h2>
              <p className="text-blue-200 mb-8 max-w-xl mx-auto">Join thousands of sales teams using ColdFox to book more meetings, protect their domain, and scale their pipeline.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup" className="bg-white text-blue-900 font-semibold px-8 py-3.5 rounded-2xl hover:bg-blue-50 transition-colors shadow-lg inline-flex items-center gap-2">
                  Start Free Today <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/pricing" className="border border-blue-400 text-white font-semibold px-8 py-3.5 rounded-2xl hover:bg-blue-900/50 transition-colors">
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

// Inline import to avoid circular deps
function Wand2({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
}
