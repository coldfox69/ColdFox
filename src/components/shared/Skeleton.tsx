/**
 * Skeleton primitives for route-level loading states.
 * They follow the neumorphic surface language: an inset well with a soft
 * pulse, so loading feels like part of the interface rather than a spinner.
 */
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[10px] bg-muted', className)} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('neu-card rounded-[16px] p-5', className)} aria-hidden="true">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

export function SkeletonTable({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('neu-card overflow-hidden rounded-[16px]', className)} aria-hidden="true">
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonPage({ title, rows = 6 }: { title: string; rows?: number }) {
  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-6 py-6 lg:px-8 lg:py-8">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonTable rows={rows} />
    </div>
  );
}
