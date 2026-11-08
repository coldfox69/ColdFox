'use client';

import Link from 'next/link';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';
import { Mail, MessageSquare, LifeBuoy } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <div className="pt-32 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 pt-4">
            <h1 className="text-4xl font-bold text-foreground mb-3">Get in touch</h1>
            <p className="text-muted-foreground">Email the address that matches your request.</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Mail, title: 'General', desc: 'hello@coldfox.io', sub: 'Product questions', mailto: 'hello@coldfox.io' },
              { icon: MessageSquare, title: 'Support', desc: 'support@coldfox.io', sub: 'Account and workspace help', mailto: 'support@coldfox.io' },
              { icon: LifeBuoy, title: 'Sales', desc: 'sales@coldfox.io', sub: 'Plans and partnerships', mailto: 'sales@coldfox.io' },
            ].map(item => (
              <a key={item.title} href={`mailto:${item.mailto}`} className="border border-border bg-card rounded-2xl p-5 block hover:bg-muted/50 transition-colors">
                <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center mb-3">
                  <item.icon className="w-4 h-4" />
                </div>
                <p className="font-semibold text-foreground text-sm">{item.title}</p>
                <p className="text-sm text-blue-600 dark:text-blue-400">{item.desc}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </a>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/signup" className="inline-block bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg hover:bg-blue-800 transition-colors">
              Create free account
            </Link>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
