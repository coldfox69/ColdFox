import type { Metadata } from 'next';
import SignupPage from '@/views/auth/SignupPage';

export const metadata: Metadata = { title: 'Create account', description: 'Create your free ColdFox account.' };

export default function Page() {
  return <SignupPage />;
}
