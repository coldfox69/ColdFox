import type { Metadata } from 'next';
import AboutPage from '@/views/public/AboutPage';

export const metadata: Metadata = {
  title: 'About',
  description: 'ColdFox is an AI-powered cold email outreach and CRM platform for modern sales teams.',
};

export default function Page() {
  return <AboutPage />;
}
