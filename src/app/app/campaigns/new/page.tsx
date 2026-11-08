import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const CampaignWizardPage = dynamic(() => import('@/views/app/CampaignWizardPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'New Campaign - ColdFox',
  description: 'Create a new outreach campaign.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const mailboxes = ctx?.organization ? (await apiFetch<{ mailboxes: any[] }>('/api/mailboxes')).mailboxes ?? [] : [];
  const templates = ctx?.organization ? await apiFetch<any[]>('/api/templates') : [];
  return (
    <CampaignWizardPage initialMailboxes={mailboxes} initialTemplates={templates} />
  );
}

