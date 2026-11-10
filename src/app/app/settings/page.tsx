import type { Metadata } from 'next';
import { SettingsRoute } from '@/components/settings/SettingsRoute';

export const metadata: Metadata = {
  title: 'Settings - ColdFox',
  description: 'Workspace and profile settings.',
};

export default function Page() {
  return <SettingsRoute />;
}
