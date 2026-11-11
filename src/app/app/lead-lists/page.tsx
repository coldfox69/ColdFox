import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const LeadListsPage = dynamic(() => import('@/views/app/LeadListsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Lead lists - ColdFox',
  description: 'Uploaded lead files, analyzed automatically, with dynamic personalization variables for your campaigns.',
};

export default function Page() {
  return <LeadListsPage />;
}
