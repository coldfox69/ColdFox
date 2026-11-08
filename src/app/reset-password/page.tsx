import type { Metadata } from 'next';
import { ResetPasswordPage } from '@/views/auth/PasswordRecoveryPages';

export const metadata: Metadata = { title: 'Choose a new password', description: 'Set a new password for your account.' };

export default function Page() {
  return <ResetPasswordPage />;
}
