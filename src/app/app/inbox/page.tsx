import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getInbox } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const InboxPage = dynamic(() => import('@/views/app/InboxPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Unified Inbox - ColdFox',
  description: 'Read and reply to conversations across mailboxes.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const threads = ctx?.organization ? await getInbox(ctx.organization.id) : [];
  return <InboxPage initialThreads={threads ?? []} currentUserId={ctx?.user.id ?? ''} />;
}
