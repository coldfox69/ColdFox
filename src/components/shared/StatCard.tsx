import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  /** Quiet caption under the figure. It states what the number is, never an invented delta. */
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  /** Semantic plate behind the icon. Defaults to a neutral tile. */
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'ai' | 'teal' | 'violet' | 'amber';
  className?: string;
}

const toneClasses = {
  neutral: 'icon-tile',
  brand: 'icon-tile-brand',
  success: 'icon-tile-success',
  warning: 'icon-tile-warning',
  danger: 'icon-tile-danger',
  ai: 'icon-tile-ai',
  teal: 'icon-tile-teal',
  violet: 'icon-tile-violet',
  amber: 'icon-tile-amber',
} as const;

export function StatCard({ title, value, change, changeType = 'neutral', icon, tone = 'neutral', className }: StatCardProps) {
  return (
    <div className={cn('neu-card rounded-[16px] p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
          <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground tabular-nums">{value}</p>
        </div>
        {icon && (
          <span className={cn('h-9 w-9 shrink-0 items-center justify-center rounded-[10px]', toneClasses[tone])}>
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
