import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coldfox.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'ColdFox: Cold Email and CRM',
    template: '%s | ColdFox',
  },
  description:
    'ColdFox is a cold email workspace with CSV import, Gmail and SMTP mailboxes, AI email writing, sequences, unified inbox, suppression list, and deliverability checks.',
  applicationName: 'ColdFox',
  keywords: ['cold email', 'AI outreach', 'sales CRM', 'email automation', 'lead generation', 'deliverability'],
  authors: [{ name: 'ColdFox' }],
  openGraph: {
    type: 'website',
    siteName: 'ColdFox',
    title: 'ColdFox: Cold Email and CRM',
    description:
      'CSV import, Gmail and SMTP mailboxes, AI email writing, sequences, unified inbox, suppression list, and deliverability checks.',
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ColdFox: Cold Email and CRM',
    description: 'Cold email workspace with import, mailboxes, AI writing, sequences, and inbox.',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0f1e' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
