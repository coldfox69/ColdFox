'use client';

import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Mail, MessageSquare, LifeBuoy } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <section className="band-raised">
        <div className="mx-auto max-w-[1600px] px-6 pb-12 pt-28 sm:px-8 lg:pt-32">
          <div className="accent-rule-top max-w-2xl pt-7">
            <h1 className="text-[36px] font-semibold text-foreground">Get in touch</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Email the address that matches your request.</p>
          </div>
        </div>
      </section>
      <div className="rule-h mx-auto max-w-[1520px]" aria-hidden="true" />
      <section className="px-6 py-14 sm:px-8 lg:py-16">
        <div className="mx-auto max-w-[1520px]">
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { icon: Mail, title: 'General', desc: 'hello@coldfox.io', sub: 'Product questions' },
              { icon: MessageSquare, title: 'Support', desc: 'support@coldfox.io', sub: 'Account and workspace help' },
              { icon: LifeBuoy, title: 'Sales', desc: 'sales@coldfox.io', sub: 'Plans and partnerships' },
            ].map(item => (
              <a key={item.title} href={`mailto:${item.desc}`} className="neu-card block rounded-[16px] p-6 transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-raised-lg)]">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-[10px] neu-inset-sm">
                  <item.icon className="w-[18px] h-[18px] text-accent-foreground" />
                </div>
                <p className="text-[14px] font-medium text-foreground">{item.title}</p>
                <p className="mt-1 text-[13px] text-accent-foreground">{item.desc}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{item.sub}</p>
              </a>
            ))}
          </div>

          <div className="mt-12">
            <Link href="/signup" className="inline-flex h-11 items-center justify-center rounded-[10px] bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-0.5 hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
              Create a free account
            </Link>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
