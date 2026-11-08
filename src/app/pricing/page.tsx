import type { Metadata } from 'next';
import PricingPage from '@/views/public/PricingPage';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple plans for teams of every size. Start free and upgrade when your outreach grows.',
};

export default function Page() {
  return <PricingPage />;
}
