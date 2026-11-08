import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  muted: 'bg-muted text-muted-foreground',
  outline: 'border border-border text-foreground bg-transparent',
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

export function StatusBadge({ variant = 'default', size = 'md', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 font-medium rounded-lg',
      variantClasses[variant],
      sizeClasses[size],
      className
    )}>
      {children}
    </span>
  );
}

export function CampaignStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    active: { label: 'Active', variant: 'success' },
    paused: { label: 'Paused', variant: 'warning' },
    draft: { label: 'Draft', variant: 'muted' },
    scheduled: { label: 'Scheduled', variant: 'info' },
    completed: { label: 'Completed', variant: 'default' },
  };
  const config = map[status] || { label: status, variant: 'muted' };
  return (
    <StatusBadge variant={config.variant}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        status === 'active' && 'bg-emerald-500',
        status === 'paused' && 'bg-amber-500',
        status === 'draft' && 'bg-slate-400',
        status === 'scheduled' && 'bg-blue-500',
        status === 'completed' && 'bg-slate-500',
      )} />
      {config.label}
    </StatusBadge>
  );
}

export function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    new: { label: 'New', variant: 'muted' },
    contacted: { label: 'Contacted', variant: 'info' },
    replied: { label: 'Replied', variant: 'success' },
    interested: { label: 'Interested', variant: 'success' },
    'not-interested': { label: 'Not Interested', variant: 'muted' },
    bounced: { label: 'Bounced', variant: 'danger' },
    unsubscribed: { label: 'Unsubscribed', variant: 'warning' },
  };
  const config = map[status] || { label: status, variant: 'muted' };
  return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
}
