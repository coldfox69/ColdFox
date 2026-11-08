import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getTemplates } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const TemplatesPage = dynamic(() => import('@/views/app/TemplatesPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Templates - ColdFox',
  description: 'Manage your email templates.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const templates = ctx?.organization ? await getTemplates(ctx.organization.id) : [];
  return <TemplatesPage initialTemplates={templates ?? []} />;
}
