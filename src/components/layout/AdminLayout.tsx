'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Building2, CreditCard, Megaphone, Mail, Activity,
  Cpu, Key, Ticket, Flag, Briefcase, Shield, Plug, Settings, ChevronLeft, Bell,
  Sun, Moon, Monitor, ExternalLink, LogOut, Gauge, FileSearch, AlertTriangle, Webhook,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { HoverPrefetchLink } from '@/components/shared/HoverPrefetchLink';
import { Logo } from '@/components/shared/Logo';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

const adminNav = [
  { icon: LayoutDashboard, label: 'Overview', path: '/admin' },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: Building2, label: 'Organizations', path: '/admin/organizations' },
  { icon: CreditCard, label: 'Subscriptions', path: '/admin/subscriptions' },
  { icon: Briefcase, label: 'Plans', path: '/admin/plans' },
  { icon: Megaphone, label: 'Campaigns', path: '/admin/campaigns' },
  { icon: Mail, label: 'Mailboxes', path: '/admin/mailboxes' },
  { icon: Activity, label: 'Email activity', path: '/admin/email-activity' },
  { icon: Cpu, label: 'AI usage', path: '/admin/ai-usage' },
  { icon: Key, label: 'API usage', path: '/admin/api-usage' },
  { icon: Ticket, label: 'Support tickets', path: '/admin/tickets' },
  { icon: Flag, label: 'Announcements', path: '/admin/announcements' },
  { icon: Flag, label: 'Feature flags', path: '/admin/feature-flags' },
  { icon: Gauge, label: 'System health', path: '/admin/system-health' },
  { icon: Briefcase, label: 'Background jobs', path: '/admin/jobs' },
  { icon: AlertTriangle, label: 'Error logs', path: '/admin/errors' },
  { icon: FileSearch, label: 'Audit and security', path: '/admin/audit' },
  { icon: Shield, label: 'Admin roles', path: '/admin/roles' },
  { icon: Webhook, label: 'Webhooks', path: '/admin/webhooks' },
  { icon: Flag, label: 'Abuse monitoring', path: '/admin/abuse' },
  { icon: Plug, label: 'Integrations', path: '/admin/integrations' },
  { icon: Settings, label: 'Global settings', path: '/admin/settings' },
];

const navRow = 'flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)]';
const navRowIdle = 'text-muted-foreground hover:text-foreground hover:shadow-[var(--shadow-inset-sm)]';
const navRowActive = 'neu-inset-sm text-accent-foreground';

export function AdminLayout({
  user,
  role,
  children,
}: {
  user: { name: string; email: string };
  role: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const initials = (user.name || user.email)
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  const isActive = (path: string) => (path === '/admin' ? pathname === '/admin' : pathname.startsWith(path));

  const signOut = async () => {
    try {
      await createBrowserSupabaseClient().auth.signOut();
    } catch {}
    router.replace('/login');
    router.refresh();
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };
  const themeLabel = theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'System mode';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className={cn('hidden lg:flex flex-col neu-shell-side relative sidebar-transition flex-shrink-0', collapsed ? 'w-16' : 'w-60')}>
        <div className={cn('flex items-center gap-3 border-b border-border px-4 py-4', collapsed && 'justify-center px-3')}>
          {collapsed ? (
            <Image src="/favicon.png" alt="ColdFox fox logo" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" sizes="36px" />
          ) : (
            <div className="min-w-0 flex-1">
              <span className="flex items-center">
                <Logo height={48} priority />
              </span>
              <p className="mt-1 text-[12px] text-muted-foreground">Admin panel</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin navigation">
          <ul className="space-y-1">
            {adminNav.map(item => (
              <li key={item.path}>
                <HoverPrefetchLink href={item.path} title={collapsed ? item.label : undefined}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  className={cn(navRow, isActive(item.path) ? navRowActive : navRowIdle, collapsed && 'justify-center px-2')}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </HoverPrefetchLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-border px-3 py-3">
          {!collapsed && (
            <div className="mx-1 mb-2 rounded-[10px] neu-inset-sm px-3 py-2">
              <p className="text-[12px] font-medium text-foreground">Restricted console</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Role: {role}</p>
            </div>
          )}
          <HoverPrefetchLink href="/app" className={cn(navRow, navRowIdle, collapsed && 'justify-center px-2')}>
            <ExternalLink className="w-4 h-4 shrink-0" />
            {!collapsed && 'Back to app'}
          </HoverPrefetchLink>
          <button onClick={signOut} className={cn(navRow, 'w-full text-destructive hover:bg-muted', collapsed && 'justify-center px-2')}>
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar"
          className="absolute -right-3 top-6 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card text-muted-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)]">
          <ChevronLeft className={cn('w-3.5 h-3.5 transition-transform duration-[var(--dur)]', collapsed && 'rotate-180')} />
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-4 px-6 neu-shell-header">
          <p className="text-[13px] font-medium text-foreground">ColdFox admin</p>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Switch theme`} title={`Theme: ${themeLabel}`}
              className="neu-btn flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground hover:text-foreground">
              {theme === 'light' ? <Sun className="w-4 h-4" /> : theme === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>
            <Link href="/admin/tickets" aria-label="Support tickets" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors duration-[var(--dur)] hover:bg-muted hover:text-foreground">
              <Bell className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 border-l border-border pl-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[12px] font-medium text-accent-foreground">
                {initials || 'SA'}
              </span>
              <span className="hidden text-[13px] font-medium text-foreground sm:block">{user.name}</span>
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
