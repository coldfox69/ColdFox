import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

/* Quiet tags inside the neutral ramp. Colour only carries meaning. */
const variantClasses = {
  default: 'bg-accent text-accent-foreground',
  success: 'bg-[color-mix(in_srgb,var(--cf-success)_14%,transparent)] text-[var(--cf-success)]',
  warning: 'bg-[color-mix(in_srgb,var(--cf-warning)_14%,transparent)] text-[var(--cf-warning)]',
  danger: 'bg-[color-mix(in_srgb,var(--destructive)_14%,transparent)] text-destructive',
  info: 'bg-accent text-accent-foreground',
  muted: 'bg-muted text-muted-foreground',
  outline: 'border border-border text-foreground',
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[12px]',
  md: 'px-2 py-0.5 text-[12px]',
};

export function StatusBadge({ variant = 'default', size = 'md', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md font-medium',
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
    cancelled: { label: 'Cancelled', variant: 'danger' },
  };
  const config = map[status] || { label: status, variant: 'muted' };
  const dot: Record<string, string> = {
    active: 'bg-[var(--cf-success)]',
    paused: 'bg-[var(--cf-warning)]',
    draft: 'bg-muted-foreground',
    scheduled: 'bg-primary',
    completed: 'bg-accent-foreground',
    cancelled: 'bg-destructive',
  };
  return (
    <StatusBadge variant={config.variant}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot[status] ?? 'bg-muted-foreground')} />
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
    'not-interested': { label: 'Not interested', variant: 'muted' },
    bounced: { label: 'Bounced', variant: 'danger' },
    unsubscribed: { label: 'Unsubscribed', variant: 'warning' },
    archived: { label: 'Archived', variant: 'muted' },
  };
  const config = map[status] || { label: status, variant: 'muted' };
  return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
}
