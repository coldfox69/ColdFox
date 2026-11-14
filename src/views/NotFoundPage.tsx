import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
          <Compass className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-accent-foreground">Error 404</p>
        <h1 className="mb-2 text-[20px] font-semibold tracking-[-0.02em] text-foreground">This page could not be found</h1>
        <p className="mb-8 text-[13px] leading-relaxed text-muted-foreground">The link may be broken or the page may have moved.</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="rounded-[10px] bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[filter] hover:brightness-105">Go to homepage</Link>
          <Link href="/app" className="rounded-[10px] border border-border bg-card px-5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">Open dashboard</Link>
        </div>
      </div>
    </div>
  );
}
