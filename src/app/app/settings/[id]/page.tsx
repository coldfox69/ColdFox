import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { getWorkspaceSettings } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const SettingsPage = dynamic(() => import('@/views/app/SettingsPage').then((mod) => mod.default));

export const metadata: Metadata = {
  title: 'Settings - ColdFox',
  description: 'Workspace and profile settings.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  const data = ctx?.organization && ctx?.user ? await getWorkspaceSettings(ctx.organization.id, ctx.user.id) : { profile: {}, organization: {}, members: [], plans: [] };
  return <SettingsPage data={data ?? { profile: {}, organization: {}, members: [], plans: [] }} />;
}
