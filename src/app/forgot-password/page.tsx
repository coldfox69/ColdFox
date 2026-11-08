import type { Metadata } from 'next';
import { ForgotPasswordPage } from '@/views/auth/PasswordRecoveryPages';

export const metadata: Metadata = { title: 'Reset password', description: 'Request a password reset link.' };

export default function Page() {
  return <ForgotPasswordPage />;
}
