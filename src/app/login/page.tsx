import type { Metadata } from 'next';
import LoginPage from '@/views/auth/LoginPage';

export const metadata: Metadata = { title: 'Sign in', description: 'Sign in to your ColdFox workspace.' };

export default function Page() {
  return <LoginPage />;
}
