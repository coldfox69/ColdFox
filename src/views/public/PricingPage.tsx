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
      <div className="pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">Simple, transparent pricing</h1>
            <p className="text-muted-foreground">Start free and scale as your outreach grows. No hidden fees.</p>
            <div className="mt-6 inline-flex items-center gap-2 bg-muted rounded-xl p-1">
              <button onClick={() => setAnnual(false)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all', !annual ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>Monthly</button>
              <button onClick={() => setAnnual(true)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2', annual ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}>
                Annual <span className="text-xs text-emerald-600 font-semibold">Save 20%</span>
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map(plan => {
              const price = annual ? Math.round(plan.price * 0.8) : plan.price;
              const isPopular = plan.id === 'pro';
              return (
                <div key={plan.id} className={cn('rounded-2xl p-6 flex flex-col relative', isPopular ? 'gradient-navy text-white shadow-2xl shadow-blue-900/30' : 'neu-card')}>
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">Most Popular</div>
                  )}
                  <div className="mb-6">
                    <p className={cn('text-xs font-semibold uppercase tracking-wide mb-1', isPopular ? 'text-blue-300' : 'text-muted-foreground')}>{plan.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className={cn('text-4xl font-black', isPopular ? 'text-white' : 'text-foreground')}>${price}</span>
                      <span className={cn('text-sm', isPopular ? 'text-blue-300' : 'text-muted-foreground')}>/mo</span>
                    </div>
                    {annual && plan.price > 0 && (
                      <p className={cn('text-xs mt-1', isPopular ? 'text-blue-300' : 'text-muted-foreground')}>Billed ${price * 12}/year</p>
                    )}
                  </div>
                  <ul className="space-y-3 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle className={cn('w-4 h-4 flex-shrink-0 mt-0.5', isPopular ? 'text-blue-300' : 'text-emerald-500')} />
                        <span className={isPopular ? 'text-blue-100' : 'text-foreground'}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.id === 'agency' ? '/contact' : '/signup'}
                    className={cn(
                      'mt-6 block text-center py-3 rounded-xl text-sm font-semibold transition-all',
                      isPopular ? 'bg-white text-blue-900 hover:bg-blue-50' : 'gradient-blue text-white hover:opacity-90'
                    )}
                  >
                    {plan.id === 'free' ? 'Get Started Free' : plan.id === 'enterprise' ? 'Contact Sales' : 'Start Free Trial'}
                  </Link>
                </div>
              );
            })}
          </div>
          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">Sample pricing for demonstration purposes — not a real commercial offer.</p>
          </div>

          {/* FAQ */}
          <div className="mt-20 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-foreground text-center mb-8">Pricing FAQ</h2>
            <div className="space-y-4">
              {[
                { q: 'Can I switch plans?', a: 'Yes, you can upgrade or downgrade at any time. Changes take effect on your next billing cycle.' },
                { q: 'What happens when I hit my limits?', a: 'You\'ll receive a notification. Campaigns pause gracefully — no data is lost. You can upgrade immediately to continue.' },
                { q: 'Is there a free trial?', a: 'Starter and Pro plans include a 14-day free trial. No credit card required to start.' },
                { q: 'What counts as a mailbox?', a: 'Each connected email account (Gmail, Outlook, or SMTP) counts as one mailbox.' },
              ].map((item, i) => (
                <div key={i} className="neu-card rounded-2xl p-5">
                  <p className="font-semibold text-foreground text-sm mb-1">{item.q}</p>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
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
