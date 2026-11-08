import type { Metadata } from 'next';
import { PublicNavbar, PublicFooter } from '@/components/layout/PublicLayout';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  description: 'Manage your email preferences.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNavbar />
      <main className="flex-1 flex items-center justify-center px-4 py-32">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✉️</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Unsubscribe from ColdFox emails</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Every outreach email we send includes a one-click unsubscribe link. Open the email you received and use the
            link at the bottom to be removed from that sender&apos;s list. If you no longer have the email, reply to it and
            ask the sender to remove you.
          </p>
          <a href="/" className="text-sm text-blue-600 hover:underline">Return to ColdFox homepage</a>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
