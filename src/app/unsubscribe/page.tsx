import type { Metadata } from 'next';
import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  description: 'Manage your email preferences.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNavbar />
      <main className="flex flex-1 items-center justify-center px-6 py-32">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full neu-inset-sm">
            <MailCheck className="w-6 h-6 text-accent-foreground" />
          </div>
          <h1 className="mb-3 text-[22px] font-semibold text-foreground">Unsubscribe from ColdFox emails</h1>
          <p className="mb-6 text-[14px] leading-[1.7] text-muted-foreground">
            Every outreach email includes a one-click unsubscribe link. Open the email you received and use the link at the bottom to be removed from that sender&apos;s list. If you no longer have the email, reply to it and ask the sender to remove you.
          </p>
          <Link href="/" className="text-[13px] text-accent-foreground hover:underline">Return to ColdFox</Link>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
