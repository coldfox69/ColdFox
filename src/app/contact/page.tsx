import type { Metadata } from 'next';
import ContactPage from '@/views/public/ContactPage';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Talk to the ColdFox team about your outreach workflow, security requirements or billing.',
};

export default function Page() {
  return <ContactPage />;
}
