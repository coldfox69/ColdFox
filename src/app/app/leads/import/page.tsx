import type { Metadata } from 'next';
import { getSessionContext } from '@/lib/auth/context';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Import Leads — ColdFox',
  description: 'Import leads from CSV or XLSX.',
};

export default async function Page() {
  const ctx = await getSessionContext();
  if (!ctx?.organization) redirect('/login');
  redirect('/app/leads#import');
}

