import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import dynamic from 'next/dynamic';

const AiWriterPage = dynamic(() => import('@/views/app/AiWriterPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'AI Email Writer - ColdFox',
  description: 'Draft, rewrite, and optimize cold emails with AI.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  if (!ctx?.organization) return null;
  return <AiWriterPage />;
}

