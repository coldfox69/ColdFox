import { getSessionContext } from '@/lib/auth/context';
import { getWorkspaceSettings } from '@/lib/data/app';
import dynamic from 'next/dynamic';

const SettingsView = dynamic(() => import('@/views/app/SettingsPage').then((mod) => mod.default));

const EMPTY = { profile: {}, organization: {}, members: [], plans: [] };

/**
 * Shared server loader for the workspace settings screen.
 * Used by both /app/settings and /app/settings/[id].
 */
export async function SettingsRoute() {
  const ctx = await getSessionContext();
  const data = ctx?.organization && ctx?.user
    ? await getWorkspaceSettings(ctx.organization.id, ctx.user.id)
    : EMPTY;
  return <SettingsView data={data ?? EMPTY} />;
}
