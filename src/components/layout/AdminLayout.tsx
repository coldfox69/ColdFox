'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Users, Building2, CreditCard, Megaphone, Mail, Activity,
  Cpu, Key, Ticket, Flag, Briefcase, Shield, Plug, Settings, ChevronLeft, Bell,
  Sun, Moon, Monitor, Sparkles, ExternalLink, LogOut, Gauge, FileSearch, AlertTriangle, Webhook,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

const adminNav = [
  { icon: LayoutDashboard, label: 'Overview', path: '/admin' },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: Building2, label: 'Organizations', path: '/admin/organizations' },
  { icon: CreditCard, label: 'Subscriptions', path: '/admin/subscriptions' },
  { icon: Briefcase, label: 'Plans', path: '/admin/plans' },
  { icon: Megaphone, label: 'Campaigns', path: '/admin/campaigns' },
  { icon: Mail, label: 'Mailboxes', path: '/admin/mailboxes' },
  { icon: Activity, label: 'Email Activity', path: '/admin/email-activity' },
  { icon: Cpu, label: 'AI Usage', path: '/admin/ai-usage' },
  { icon: Key, label: 'API Usage', path: '/admin/api-usage' },
  { icon: Ticket, label: 'Support Tickets', path: '/admin/tickets' },
  { icon: Sparkles, label: 'Announcements', path: '/admin/announcements' },
  { icon: Flag, label: 'Feature Flags', path: '/admin/feature-flags' },
  { icon: Gauge, label: 'System Health', path: '/admin/system-health' },
  { icon: Briefcase, label: 'Background Jobs', path: '/admin/jobs' },
  { icon: AlertTriangle, label: 'Error Logs', path: '/admin/errors' },
  { icon: FileSearch, label: 'Audit & Security', path: '/admin/audit' },
  { icon: Shield, label: 'Admin Roles', path: '/admin/roles' },
  { icon: Webhook, label: 'Webhooks', path: '/admin/webhooks' },
  { icon: Flag, label: 'Abuse Monitoring', path: '/admin/abuse' },
  { icon: Plug, label: 'Integrations', path: '/admin/integrations' },
  { icon: Settings, label: 'Global Settings', path: '/admin/settings' },
];

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
      <aside className={cn('hidden lg:flex flex-col neu-shell-side flex-shrink-0 sidebar-transition relative', collapsed ? 'w-16' : 'w-60')}>
        <div className={cn('flex items-center gap-3 px-4 py-4 border-b border-border', collapsed && 'justify-center px-3')}>
          {collapsed ? (
            <Image src="/favicon.png" alt="ColdFox fox logo" width={40} height={40} className="h-10 w-10 shrink-0 rounded-full" />
          ) : (
            <div className="min-w-0 flex-1">
              <span className="flex items-center justify-center">
                <Image src="/logo.png" alt="ColdFox - Smarter Cold Email Outreach" width={240} height={56} className="h-14 w-auto max-w-full object-contain" />
              </span>
              <p className="text-[10px] text-muted-foreground mt-1.5">Admin Panel</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto" aria-label="Admin navigation">
          {adminNav.map(item => (
            <Link key={item.path} href={item.path} title={collapsed ? item.label : undefined}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={cn('flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                isActive(item.path) ? 'neu-inset-sm text-accent-foreground' : 'text-muted-foreground hover:shadow-[var(--neu-inset-sm)] hover:text-foreground',
                collapsed && 'justify-center px-2')}>
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="px-2 pb-4 border-t border-border pt-2 space-y-1">
          {!collapsed && (
            <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mx-1">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Restricted console</p>
              <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">Role: {role}</p>
            </div>
          )}
          <Link href="/app" className={cn('flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted', collapsed && 'justify-center')}>
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            {!collapsed && 'Back to app'}
          </Link>
          <button onClick={signOut} className={cn('w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20', collapsed && 'justify-center')}>
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && 'Sign out'}
          </button>
        </div>

        <button onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar"
          className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:shadow-md z-10">
          <ChevronLeft className={cn('w-3 h-3 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center h-14 px-6 neu-shell-header gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-foreground">ColdFox Admin</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Switch theme`} title={`Theme: ${themeLabel}`}
              className="neu-btn w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground">
              {theme === 'light' ? <Sun className="w-4 h-4" /> : theme === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>
            <Link href="/admin/tickets" aria-label="Support tickets" className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground">
              <Bell className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-[var(--neu-elevated-sm)]">
                <span className="text-white text-xs font-bold">{initials || 'SA'}</span>
              </div>
              <span className="text-sm font-medium text-foreground hidden sm:block">{user.name}</span>
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
