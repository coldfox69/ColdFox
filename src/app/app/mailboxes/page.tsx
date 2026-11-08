import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getMailboxes } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const MailboxesPage = dynamic(() => import('@/views/app/MailboxesPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Mailboxes - ColdFox',
  description: 'Connect and manage your sending mailboxes.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const result = ctx?.organization ? await getMailboxes(ctx.organization.id) : { mailboxes: [], providers: { gmail: false, outlook: false } };
  return <MailboxesPage initialMailboxes={result?.mailboxes ?? []} providers={result?.providers ?? { gmail: false, outlook: false }} />;
}
