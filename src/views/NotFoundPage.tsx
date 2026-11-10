import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-full neu-inset-sm flex items-center justify-center mx-auto mb-5">
          <Compass className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-accent-foreground mb-2">Error 404</p>
        <h1 className="text-[20px] font-semibold text-foreground mb-2">This page could not be found</h1>
        <p className="text-sm text-muted-foreground mb-8">The link may be broken or the page may have moved.</p>
        <div className="flex justify-center gap-3">
          <Link href="/" className="px-5 py-2.5 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">Go to homepage</Link>
          <Link href="/app" className="px-5 py-2.5 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50">Open dashboard</Link>
        </div>
      </div>
    </div>
  );
}
