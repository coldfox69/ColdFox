import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'muted' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

/* Quiet tags inside the semantic ramp. Colour only carries meaning. */
const variantClasses = {
  default: 'bg-muted text-muted-foreground',
  brand: 'bg-[var(--brand-soft)] text-[var(--brand-strong)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  ai: 'bg-[var(--ai-soft)] text-[var(--ai)]',
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
    completed: { label: 'Completed', variant: 'success' },
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
