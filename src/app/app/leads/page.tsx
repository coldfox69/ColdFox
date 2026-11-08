import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const LeadsPage = dynamic(() => import('@/views/app/LeadsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Leads & CRM — ColdFox',
  description: 'Manage your contacts and import leads.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const result = ctx?.organization ? await apiFetch<any>('/api/leads?pageSize=1000') : { leads: [] };
  return <LeadsPage initialLeads={result?.leads ?? []} />;
}

