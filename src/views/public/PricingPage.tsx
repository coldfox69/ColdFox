'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { CheckCircle } from 'lucide-react';
import { plans } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="px-6 pb-16 pt-28 sm:px-8 lg:pt-32">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl">
            <h1 className="text-[36px] font-semibold text-foreground">Pricing</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">The free plan stays free. Paid plans add mailboxes, leads and higher sending limits.</p>
            <div className="mt-6 inline-flex items-center gap-1 rounded-[10px] bg-input p-1 shadow-[var(--shadow-inset-sm)]">
              <button onClick={() => setAnnual(false)} aria-pressed={!annual} className={cn('rounded-[8px] px-4 py-1.5 text-sm font-medium transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)]', !annual ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground')}>Monthly</button>
              <button onClick={() => setAnnual(true)} aria-pressed={annual} className={cn('flex items-center gap-2 rounded-[8px] px-4 py-1.5 text-sm font-medium transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)]', annual ? 'bg-card text-foreground shadow-[var(--shadow-raised-sm)]' : 'text-muted-foreground')}>
                Annual <span className="text-[12px] text-[var(--cf-success)]">Save 20%</span>
              </button>
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map(plan => {
              const price = annual ? Math.round(plan.price * 0.8) : plan.price;
              const isPopular = plan.id === 'pro';
              return (
                <div key={plan.id} className={cn('flex flex-col rounded-[16px] p-6', isPopular ? 'neu-card-lg ring-1 ring-primary/40' : 'neu-card')}>
                  <p className="mb-2 h-4 text-[12px] font-medium text-accent-foreground">{isPopular ? 'Most used' : ''}</p>
                  <p className="text-[13px] font-medium text-muted-foreground">{plan.name}</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-[32px] font-medium leading-none text-foreground tabular-nums">${price}</span>
                    <span className="text-[13px] text-muted-foreground">/mo</span>
                  </div>
                  {annual && plan.price > 0 && (
                    <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">Billed ${price * 12} a year</p>
                  )}
                  <ul className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-[13px] text-foreground">
                        <CheckCircle className="mt-0.5 w-4 h-4 shrink-0 text-accent-foreground" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.id === 'agency' ? '/contact' : '/signup'}
                    className={cn(
                      'mt-6 block rounded-[10px] py-2.5 text-center text-sm font-medium transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)]',
                      isPopular
                        ? 'bg-primary text-primary-foreground shadow-[var(--shadow-raised-sm)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]'
                        : 'bg-card text-foreground shadow-[var(--shadow-raised-sm)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]'
                    )}
                  >
                    {plan.id === 'free' ? 'Create account' : plan.id === 'enterprise' ? 'Contact us' : 'Start free trial'}
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-[12px] text-muted-foreground">Limits apply per workspace. Paid billing is enabled per account. Contact us before upgrading if you need custom limits.</p>

          <div className="mx-auto mt-20 max-w-2xl">
            <h2 className="text-[24px] font-semibold text-foreground">Pricing questions</h2>
            <div className="mt-6 space-y-3">
              {[
                { q: 'Can I switch plans?', a: 'Yes. You can upgrade or downgrade at any time, and the change takes effect on your next billing cycle.' },
                { q: 'What happens when I hit a limit?', a: 'You get a notification. Campaigns pause and no data is lost, so you can upgrade and continue.' },
                { q: 'Is there a free trial?', a: 'Starter and Growth include a 14-day free trial. No credit card is needed to start.' },
                { q: 'What counts as a mailbox?', a: 'Each connected email account, whether Gmail, Outlook or SMTP, counts as one mailbox.' },
              ].map(item => (
                <div key={item.q} className="neu-card rounded-[16px] p-5">
                  <p className="text-[14px] font-medium text-foreground">{item.q}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
