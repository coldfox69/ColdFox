import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
          <Compass className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">Error 404</p>
        <h1 className="text-2xl font-bold text-foreground mb-2">This page could not be found</h1>
        <p className="text-sm text-muted-foreground mb-8">The link may be broken or the page may have moved.</p>
        <div className="flex justify-center gap-3">
          <Link href="/" className="px-5 py-2.5 rounded-xl gradient-blue text-white text-sm font-semibold">Go to homepage</Link>
          <Link href="/app" className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted">Open dashboard</Link>
        </div>
      </div>
    </div>
  );
}
