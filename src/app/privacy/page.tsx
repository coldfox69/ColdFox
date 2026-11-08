import type { Metadata } from 'next';
import { PrivacyPage } from '@/views/public/LegalPages';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How ColdFox collects, uses and protects your data.',
};

export default function Page() {
  return <PrivacyPage />;
}
