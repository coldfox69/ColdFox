import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const SuppressionPage = dynamic(() => import('@/views/app/SuppressionPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Suppression List — ColdFox',
  description: 'Unsubscribes, bounces, and complaints.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await apiFetch<any>('/api/suppression') : { entries: [], reasons: [] };
  return <SuppressionPage data={data ?? { entries: [], reasons: [] }} />;
}

