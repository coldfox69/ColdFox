import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Brain, Zap, Shield, Users, BarChart2, Inbox, Check } from 'lucide-react';

const features = [
  {
    category: 'Lead Management',
    icon: Users,
    color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    items: [
      { title: 'CSV & XLSX Import', desc: 'Upload lead spreadsheets with drag-and-drop. Automatic column detection and mapping.' },
      { title: 'AI Lead Analysis', desc: 'Automatic data quality checks: invalid emails, missing fields, duplicates, and enrichment suggestions.' },
      { title: 'CRM Pipeline', desc: 'Track leads through custom stages. Add notes, tags, and next follow-up reminders.' },
      { title: 'Lead Profile View', desc: 'Full contact history, campaign participation, conversation threads, and activity timeline.' },
    ]
  },
  {
    category: 'Email & AI Writing',
    icon: Brain,
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    items: [
      { title: 'AI Email Writer', desc: 'Generate personalized cold emails using lead data. One-click tone and length adjustments.' },
      { title: 'Template Library', desc: 'Personal and shared template libraries with categories, search, and version history.' },
      { title: 'Subject Line Generator', desc: 'AI-generated subject line variants optimized for relevance and deliverability.' },
      { title: 'AI Optimizer', desc: 'Side-by-side before/after comparison with clarity scores and spam-risk warnings.' },
    ]
  },
  {
    category: 'Campaign Automation',
    icon: Zap,
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    items: [
      { title: 'Multi-step Sequences', desc: 'Build follow-up sequences with smart delays. Auto-stop on reply or unsubscribe.' },
      { title: 'Template Rotation', desc: 'Rotate multiple email variants across a sequence for content testing and natural variation.' },
      { title: 'Sending Schedules', desc: 'Set sending windows, timezone awareness, weekday selection, and daily caps.' },
      { title: 'Visual Workflow Builder', desc: 'Build automation flows with triggers, delays, branches, and conditions visually.' },
    ]
  },
  {
    category: 'Mailbox & Deliverability',
    icon: Shield,
    color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    items: [
      { title: 'Gmail & Outlook Integration', desc: 'Connect your real mailboxes via OAuth. Emails sent from your own domain, not shared IPs.' },
      { title: 'SMTP/IMAP Support', desc: 'Connect any email provider using standard SMTP/IMAP credentials.' },
      { title: 'Deliverability Center', desc: 'SPF, DKIM, DMARC status monitoring with step-by-step DNS setup guides.' },
      { title: 'Bounce & Complaint Monitoring', desc: 'Track hard bounces and complaints. Auto-suppress problematic contacts.' },
    ]
  },
  {
    category: 'Inbox & Conversations',
    icon: Inbox,
    color: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    items: [
      { title: 'Unified Inbox', desc: 'All replies from all campaigns in one place. Three-panel layout for efficient management.' },
      { title: 'Conversation Threading', desc: 'Full email thread history with lead context panel and campaign reference.' },
      { title: 'Internal Notes', desc: 'Add private notes to conversations for team collaboration.' },
      { title: 'Reply Actions', desc: 'Archive, assign, and update lead status directly from the inbox.' },
    ]
  },
  {
    category: 'Analytics & Reporting',
    icon: BarChart2,
    color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    items: [
      { title: 'Campaign Analytics', desc: 'Track delivery, reply rates, and bounce rates per campaign. Date range filtering.' },
      { title: 'Mailbox Performance', desc: 'Per-mailbox sending stats and health indicators.' },
      { title: 'Report Export', desc: 'Download analytics reports in CSV for external analysis and team sharing.' },
      { title: 'Suppression Reports', desc: 'Full visibility into unsubscribes, bounces, and complaints.' },
    ]
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 pt-8">
            <h1 className="text-4xl font-bold text-foreground mb-4">A complete outreach platform</h1>
            <p className="text-muted-foreground text-lg">Every feature you need — from first import to closed deal.</p>
          </div>
          <div className="space-y-16">
            {features.map(section => (
              <div key={section.category}>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${section.color}`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{section.category}</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {section.items.map(item => (
                    <div key={item.title} className="neu-card rounded-2xl p-5">
                      <div className="flex items-start gap-2 mb-2">
                        <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed pl-6">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-16 gradient-navy rounded-3xl p-10 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">Ready to see it in action?</h2>
            <p className="text-blue-200 mb-6 text-sm">Start with the free plan — no credit card required.</p>
            <Link href="/signup" className="inline-block bg-white text-blue-900 font-semibold px-8 py-3 rounded-2xl hover:bg-blue-50 transition-colors">
              Create Free Account
            </Link>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
