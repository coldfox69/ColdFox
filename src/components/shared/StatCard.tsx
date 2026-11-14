import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  /** Quiet caption under the figure. It states what the number is, never an invented delta. */
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ title, value, change, changeType = 'neutral', icon, className }: StatCardProps) {
  return (
    <div className={cn('neu-card rounded-[16px] p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums">{value}</p>
        </div>
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
            {icon}
          </span>
        )}
      </div>
      {change && (
        <p className={cn(
          'mt-2 text-[12px]',
          changeType === 'positive' && 'text-[var(--cf-success)]',
          changeType === 'negative' && 'text-destructive',
          changeType === 'neutral' && 'text-muted-foreground',
        )}>
          {change}
        </p>
      )}
    </div>
  );
}
