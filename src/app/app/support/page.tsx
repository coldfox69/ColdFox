import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getSupport } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const SupportPage = dynamic(() => import('@/views/app/SupportPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Support - ColdFox',
  description: 'Help articles and support tickets.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await getSupport(ctx.organization.id) : { tickets: [], categories: [], articles: [] };
  return <SupportPage data={data ?? { tickets: [], categories: [], articles: [] }} />;
}
