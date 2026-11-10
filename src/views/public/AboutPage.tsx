import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Check } from 'lucide-react';

const principles = [
  { title: 'Deliverability first', desc: 'Sending habits that protect the domain come before volume.' },
  { title: 'Plain reporting', desc: 'Counts say what they measure and where the number came from.' },
  { title: 'Your data stays yours', desc: 'Leads are not sold or shared, and they can be exported or deleted.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <section className="band-raised">
        <div className="mx-auto max-w-[1600px] px-6 pb-12 pt-28 sm:px-8 lg:pt-32">
          <div className="accent-rule-top max-w-2xl pt-7">
            <h1 className="text-[36px] font-semibold text-foreground">Built for careful outreach</h1>
            <p className="mt-4 text-[16px] leading-[1.7] text-muted-foreground">
              ColdFox is a workspace for lead import, email templates, sequences, inbox handling and deliverability checks. You bring your own mailboxes and your own contact lists.
            </p>
          </div>
        </div>
      </section>
      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />
      <section className="px-6 py-14 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-[1520px]">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-[22px] font-semibold text-foreground">What the product is</h2>
              <p className="mt-3 text-[15px] leading-[1.7] text-muted-foreground">
                Cold outreach works when the message is relevant and the recipient can be contacted lawfully. ColdFox keeps the leads, templates, campaigns and replies in one place so you can review what went out and what came back.
              </p>
              <p className="mt-4 text-[15px] leading-[1.7] text-muted-foreground">
                The controls that matter are suppression lists, daily caps, sending windows, stop-on-reply rules and DNS checks for SPF, DKIM and DMARC.
              </p>
            </div>
            <div>
              <h2 className="text-[22px] font-semibold text-foreground">How it works</h2>
              <ul className="mt-4 space-y-3">
                {principles.map(p => (
                  <li key={p.title} className="neu-card rounded-[16px] p-5">
                    <div className="flex items-start gap-3">
                      <Check className="mt-0.5 w-4 h-4 shrink-0 text-accent-foreground" />
                      <div>
                        <p className="text-[14px] font-medium text-foreground">{p.title}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{p.desc}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="neu-card-lg mt-14 rounded-[20px] p-10 text-center">
            <h2 className="text-[24px] font-semibold text-foreground">Create your workspace</h2>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">Import leads, connect a mailbox, and run a first campaign.</p>
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
