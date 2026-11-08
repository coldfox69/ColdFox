import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { apiFetch } from '@/lib/client/api';
import dynamic from 'next/dynamic';

const SettingsPage = dynamic(() => import('@/views/app/SettingsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Settings - ColdFox',
  description: 'Workspace and profile settings.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization ? await apiFetch<any>('/api/settings') : { profile: {}, organization: {}, members: [], plans: [] };
  return <SettingsPage data={data ?? { profile: {}, organization: {}, members: [], plans: [] }} />;
}
