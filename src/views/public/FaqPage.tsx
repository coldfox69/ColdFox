'use client';

import { useState } from 'react';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqCategories = [
  {
    category: 'General',
    items: [
      { q: 'What is ColdFox?', a: 'ColdFox is an AI-powered cold email outreach and CRM platform. It helps sales teams, agencies, and recruiters manage leads, write personalized emails, run campaigns, and track results.' },
      { q: 'Is ColdFox suitable for my business?', a: 'ColdFox is designed for anyone doing professional outreach: B2B sales teams, growth marketers, recruiters, business development professionals, and agencies managing outreach for clients.' },
      { q: 'Can I try ColdFox before paying?', a: 'Yes. The Free plan is permanently free. Starter and Pro plans include a 14-day free trial with no credit card required.' },
    ]
  },
  {
    category: 'Email Deliverability',
    items: [
      { q: 'Does ColdFox guarantee my emails will land in the inbox?', a: 'No, and no legitimate platform can make this guarantee. Email placement is determined by recipient email providers based on your domain reputation, content, sending history, and many other factors. ColdFox helps you maintain good sending practices, but cannot override provider spam filters.' },
      { q: 'What is Template Rotation?', a: 'Template Rotation lets you alternate between multiple email variants in a sequence. This is for content testing and natural message variation. It is not a technique to bypass spam filters, and it does not guarantee improved inbox placement.' },
      { q: 'How does ColdFox protect my domain?', a: 'ColdFox provides SPF, DKIM, and DMARC monitoring, sending health indicators, bounce tracking, and best-practice guidance. Following these recommendations helps protect your sender reputation over time.' },
    ]
  },
  {
    category: 'Privacy & Compliance',
    items: [
      { q: 'Does ColdFox handle unsubscribes automatically?', a: 'Yes. ColdFox maintains a suppression list for unsubscribes, hard bounces, and complaints. Suppressed contacts are automatically excluded from all future campaigns.' },
      { q: 'Can I export or delete my data?', a: 'Yes. You can export all lead data and campaign data from the Settings page. You can also request full account deletion, which permanently removes your data.' },
      { q: 'Does ColdFox share my contact data?', a: 'No. Your lead data is private to your account and is never sold or shared with third parties.' },
    ]
  },
  {
    category: 'Technical',
    items: [
      { q: 'Which email providers can I connect?', a: 'ColdFox supports Gmail (via OAuth), Microsoft Outlook (via OAuth), and any provider using standard SMTP/IMAP credentials.' },
      { q: 'What file formats can I import for leads?', a: 'ColdFox supports CSV and XLSX (Excel) files for lead import. The column mapper handles most standard column naming conventions automatically.' },
      { q: 'Is there an API?', a: 'Yes. API access is available on Pro and Enterprise plans. You can find your API keys and documentation in Settings > API Keys.' },
    ]
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-32 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 pt-4">
            <h1 className="text-4xl font-bold text-foreground mb-3">Frequently Asked Questions</h1>
            <p className="text-muted-foreground">Find answers to common questions about ColdFox.</p>
          </div>
          <div className="space-y-10">
            {faqCategories.map(cat => (
              <div key={cat.category}>
                <h2 className="text-lg font-bold text-foreground mb-4">{cat.category}</h2>
                <div className="space-y-2">
                  {cat.items.map((item, i) => {
                    const key = `${cat.category}-${i}`;
                    return (
                      <div key={key} className="neu-card rounded-2xl overflow-hidden">
                        <button
                          className="w-full flex items-center justify-between px-6 py-4 text-left"
                          onClick={() => setOpen(open === key ? null : key)}
                        >
                          <span className="font-medium text-foreground text-sm pr-4">{item.q}</span>
                          {open === key ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        </button>
                        {open === key && (
                          <div className="px-6 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">{item.a}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
