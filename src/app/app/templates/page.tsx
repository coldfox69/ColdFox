import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const TemplatesPage = dynamic(() => import('@/views/app/TemplatesPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Templates — ColdFox',
  description: 'Manage your email templates.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const templates = ctx?.organization ? await apiFetch<any[]>('/api/templates') : [];
  return <TemplatesPage initialTemplates={templates ?? []} />;
}

