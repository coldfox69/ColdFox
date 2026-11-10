'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/shared/ToastProvider';
import { PerfReporter } from '@/components/shared/PerfReporter';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="coldfox-theme">
      <ToastProvider>
        <PerfReporter />
        {children}
      </ToastProvider>
    </ThemeProvider>
  );
}
