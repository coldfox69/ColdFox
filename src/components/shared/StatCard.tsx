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

export function StatCard({ title, value, change, changeType = 'neutral', className }: StatCardProps) {
  return (
    <div className={cn('neu-card rounded-[16px] p-5', className)}>
      <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-[28px] font-medium leading-none text-foreground tabular-nums">{value}</p>
      {change && (
        <p className={cn(
          'mt-2 text-[13px]',
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
