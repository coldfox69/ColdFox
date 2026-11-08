import { cn } from '@/lib/utils';
import { FileText, Users, Mail, BarChart2, Search, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function EmptyState({ icon, title, description, action, className, size = 'md' }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center',
      size === 'sm' && 'py-8 px-4',
      size === 'md' && 'py-16 px-8',
      size === 'lg' && 'py-24 px-12',
      className
    )}>
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="font-semibold text-foreground text-base">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const emptyStateIcons = { FileText, Users, Mail, BarChart2, Search, Inbox };
