import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getDeliverability } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const DeliverabilityPage = dynamic(() => import('@/views/app/DeliverabilityPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Deliverability - ColdFox',
  description: 'Domain authentication and sending health.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await getDeliverability(ctx.organization.id) : { domains: [], checks: [] };
  return <DeliverabilityPage data={data ?? { domains: [], checks: [] }} />;
}
