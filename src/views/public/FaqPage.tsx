'use client';

import { useState } from 'react';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqCategories = [
  {
    category: 'General',
    items: [
      { q: 'What is ColdFox?', a: 'A cold email workspace with a CRM attached. It covers lead import, email templates, sequences, a unified inbox, suppression and deliverability checks.' },
      { q: 'Who is it for?', a: 'Teams doing professional outbound: B2B sales, growth teams, recruiters, business development and agencies running outreach for clients.' },
      { q: 'Can I try it before paying?', a: 'Yes. The free plan stays free. Starter and Growth include a 14-day trial with no credit card needed.' },
    ],
  },
  {
    category: 'Deliverability',
    items: [
      { q: 'Does ColdFox guarantee inbox delivery?', a: 'No, and no platform can. Placement is decided by the receiving provider, based on your domain reputation, content and sending history. ColdFox keeps the sending practices healthy and the records visible.' },
      { q: 'What is template rotation?', a: 'Alternating between message variants across a sequence, for content testing and natural variation. It is not a way around spam filters and it does not promise placement.' },
      { q: 'How does it protect my domain?', a: 'SPF, DKIM and DMARC checks, sending health per mailbox, bounce and complaint tracking, and a suppression list that is applied before every send.' },
    ],
  },
  {
    category: 'Privacy and compliance',
    items: [
      { q: 'Are unsubscribes handled?', a: 'Yes. ColdFox keeps a suppression list for unsubscribes, hard bounces and complaints, and excluded contacts are never picked up by a later campaign.' },
      { q: 'Can I export or delete my data?', a: 'Yes. Export leads and campaign data from Settings, or request full account deletion.' },
      { q: 'Is my contact data shared?', a: 'No. Your lead data stays in your workspace and is not sold or shared with third parties for advertising.' },
    ],
  },
  {
    category: 'Technical',
    items: [
      { q: 'Which mail providers can I connect?', a: 'Gmail and Microsoft Outlook over OAuth, plus any provider that accepts standard SMTP or IMAP credentials.' },
      { q: 'Which file formats can I import?', a: 'CSV and XLSX. The column mapper recognises the common naming conventions and flags anything it is unsure about.' },
      { q: 'Is there an API?', a: 'API access is included with the higher plans. Keys and documentation live in Settings.' },
    ],
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <section className="band-raised">
        <div className="mx-auto max-w-3xl px-6 pb-12 pt-28 sm:px-8 lg:pt-32">
          <div className="accent-rule-top pt-7">
            <h1 className="text-[36px] font-semibold text-foreground">Frequently asked questions</h1>
          </div>
        </div>
      </section>
      <div className="rule-h mx-auto max-w-3xl" aria-hidden="true" />
      <section className="px-6 py-14 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="space-y-10">
            {faqCategories.map(cat => (
              <div key={cat.category}>
                <h2 className="mb-4 text-[16px] font-semibold text-foreground">{cat.category}</h2>
                <div className="space-y-2">
                  {cat.items.map((item, i) => {
                    const key = `${cat.category}-${i}`;
                    return (
                      <div key={key} className="overflow-hidden rounded-[16px] neu-card">
                        <button
                          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                          onClick={() => setOpen(open === key ? null : key)}
                          aria-expanded={open === key}
                        >
                          <span className="pr-4 text-[14px] font-medium text-foreground">{item.q}</span>
                          {open === key ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
                        </button>
                        {open === key && (
                          <div className="border-t border-border px-5 pb-4 pt-3 text-[13px] leading-relaxed text-muted-foreground">{item.a}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
