import type { Metadata } from 'next';
import { AcceptableUsePage } from '@/views/public/LegalPages';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description: 'Rules for responsible, compliant outreach with ColdFox.',
};

export default function Page() {
  return <AcceptableUsePage />;
}
