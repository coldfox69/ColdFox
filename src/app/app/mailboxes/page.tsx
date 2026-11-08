import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const MailboxesPage = dynamic(() => import('@/views/app/MailboxesPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Mailboxes - ColdFox',
  description: 'Connect and manage your sending mailboxes.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const result = ctx?.organization ? await apiFetch<{ mailboxes: any[]; providers: { gmail: boolean; outlook: boolean } }>('/api/mailboxes') : { mailboxes: [], providers: { gmail: false, outlook: false } };
  return <MailboxesPage initialMailboxes={result?.mailboxes ?? []} providers={result?.providers ?? { gmail: false, outlook: false }} />;
}

