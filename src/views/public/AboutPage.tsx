import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Sparkles } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-32 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 pt-4">
            <h1 className="text-4xl font-bold text-foreground mb-4">Built for careful outreach</h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">ColdFox is a workspace for lead import, email templates, sequences, inbox handling, and deliverability checks. You bring your own mailboxes and contact lists.</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">What ColdFox is</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Cold outreach requires relevant messages sent to people who can be contacted lawfully. ColdFox stores your leads, templates, campaigns, and replies so you can review what was sent and what came back.</p>
              <p className="text-muted-foreground leading-relaxed">Key controls include suppression lists, daily caps, sending windows, stop-on-reply rules, and DNS checks for SPF, DKIM, and DMARC.</p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">How ColdFox works</h2>
              <div className="space-y-3">
                {[
                  { title: 'Your data stays yours', desc: 'Leads you import belong to your workspace. Export or delete them from Settings.' },
                  { title: 'Your mailboxes send the email', desc: 'Messages are sent from Gmail, Outlook, or SMTP accounts you connect. ColdFox does not use shared sending infrastructure.' },
                  { title: 'Checks before sending', desc: 'Suppression, bounce history, and deliverability status are checked before a campaign launch.' },
                ].map(v => (
                  <div key={v.title} className="flex gap-3 p-4 border border-border bg-card rounded-xl">
                    <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground text-sm">{v.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-10 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">Create your workspace</h2>
            <p className="text-blue-200 mb-6 text-sm">Import leads, connect a mailbox, and run a first campaign.</p>
            <Link href="/signup" className="inline-block bg-white text-blue-900 font-semibold px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors">
              Create free account
            </Link>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
