'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/shared/ToastProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="coldfox-theme">
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}
