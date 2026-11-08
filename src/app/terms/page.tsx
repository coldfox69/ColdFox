import type { Metadata } from 'next';
import { TermsPage } from '@/views/public/LegalPages';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'ColdFox Terms of Service.',
};

export default function Page() {
  return <TermsPage />;
}
