import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';

const LeadProfilePage = dynamic(() => import('@/views/app/LeadProfilePage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Lead Details - ColdFox',
  description: 'View lead profile and conversation history.',
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx?.organization) redirect('/login');
  const [detail, coworkers] = await Promise.all([
    apiFetch<any>(`/api/leads/${id}`),
    apiFetch<any>('/api/leads?pageSize=50'),
  ]);
  if (!detail || detail.error) redirect('/app/leads');
  return <LeadProfilePage detail={detail} coworkers={coworkers?.leads ?? []} />;
}
