import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getSuppression } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const SuppressionPage = dynamic(() => import('@/views/app/SuppressionPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Suppression List - ColdFox',
  description: 'Unsubscribes, bounces, and complaints.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await getSuppression(ctx.organization.id) : { entries: [], reasons: [] };
  return <SuppressionPage data={data ?? { entries: [], reasons: [] }} />;
}
