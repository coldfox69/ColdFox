import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getMailboxes, getTemplates } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const CampaignWizardPage = dynamic(() => import('@/views/app/CampaignWizardPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'New Campaign - ColdFox',
  description: 'Create a new outreach campaign.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const orgId = ctx?.organization?.id ?? null;
  const mailboxResult = orgId ? await getMailboxes(orgId) : { mailboxes: [], providers: { gmail: false, outlook: false } };
  const templates = orgId ? await getTemplates(orgId) : [];
  return (
    <CampaignWizardPage initialMailboxes={mailboxResult.mailboxes} initialTemplates={templates} />
  );
}
