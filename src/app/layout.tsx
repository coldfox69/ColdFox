import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coldfox.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'ColdFox — AI-Powered Cold Email Outreach & CRM',
    template: '%s | ColdFox',
  },
  description:
    'ColdFox helps sales teams run thoughtful, compliant cold email outreach with AI writing, CRM, unified inbox, deliverability checks and durable sending infrastructure.',
  applicationName: 'ColdFox',
  keywords: ['cold email', 'AI outreach', 'sales CRM', 'email automation', 'lead generation', 'deliverability'],
  authors: [{ name: 'ColdFox' }],
  openGraph: {
    type: 'website',
    siteName: 'ColdFox',
    title: 'ColdFox — AI-Powered Cold Email Outreach & CRM',
    description:
      'Run thoughtful, compliant cold email outreach with AI writing, CRM, unified inbox and deliverability checks.',
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ColdFox — AI-Powered Cold Email Outreach & CRM',
    description: 'AI-powered cold email outreach and CRM for modern sales teams.',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [
      {
        url:
          'data:image/svg+xml,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1e40af"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#g)"/><path d="M32 14l4.6 9.9 10.9 1.3-8.1 7.4 2.2 10.8L32 38.2l-9.6 5.2 2.2-10.8-8.1-7.4 10.9-1.3z" fill="#fff"/></svg>',
          ),
      },
    ],
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
