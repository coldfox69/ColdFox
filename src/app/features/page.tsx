import type { Metadata } from 'next';
import FeaturesPage from '@/views/public/FeaturesPage';

export const metadata: Metadata = {
  title: 'Features',
  description: 'AI lead intelligence, email writing, CRM, unified inbox, deliverability checks and analytics in one outreach platform.',
};

export default function Page() {
  return <FeaturesPage />;
}
