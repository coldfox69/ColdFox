import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  iconColor?: string;
  className?: string;
}

export function StatCard({ title, value, change, changeType = 'neutral', icon, iconColor = 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', className }: StatCardProps) {
  return (
    <div className={cn('neu-card rounded-2xl p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {change && (
            <p className={cn(
              'text-xs mt-1 font-medium',
              changeType === 'positive' && 'text-emerald-600 dark:text-emerald-400',
              changeType === 'negative' && 'text-red-500 dark:text-red-400',
              changeType === 'neutral' && 'text-muted-foreground',
            )}>
              {change}
            </p>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', iconColor)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
