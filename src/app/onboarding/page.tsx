import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import OnboardingPage from '@/views/auth/OnboardingPage';
import { getSessionContext } from '@/lib/auth/context';

export const metadata: Metadata = { title: 'Set up your workspace', description: 'Tell us about your team.' };

export default async function Page() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login?next=/onboarding');
  if (ctx.onboardingCompleted) redirect('/app');
  return <OnboardingPage />;
}
