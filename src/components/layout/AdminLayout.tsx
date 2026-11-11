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
  BarChart3, UserRound, Receipt, TrendingUp, Coins, Filter, ScrollText, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { HoverPrefetchLink } from '@/components/shared/HoverPrefetchLink';
import { Logo } from '@/components/shared/Logo';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { canReadModule } from '@/lib/admin/shared';
import { AdminPermissionsProvider } from '@/components/admin/AdminPermissions';

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  module: string;
}

const adminNav: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Admin overview', path: '/admin', module: 'overview' },
      { icon: BarChart3, label: 'Platform analytics', path: '/admin/analytics', module: 'analytics' },
    ],
  },
  {
    label: 'CRM and users',
    items: [
      { icon: Users, label: 'User management', path: '/admin/users', module: 'users' },
      { icon: Building2, label: 'Organizations', path: '/admin/organizations', module: 'organizations' },
      { icon: UserRound, label: 'Lead management', path: '/admin/leads', module: 'leads' },
      { icon: Shield, label: 'Admin accounts', path: '/admin/roles', module: 'roles' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { icon: Megaphone, label: 'Campaigns', path: '/admin/campaigns', module: 'campaigns' },
      { icon: Mail, label: 'Mailboxes', path: '/admin/mailboxes', module: 'mailboxes' },
      { icon: Activity, label: 'Email activity', path: '/admin/email-activity', module: 'email-activity' },
      { icon: AlertTriangle, label: 'Deliverability', path: '/admin/abuse', module: 'abuse' },
      { icon: Briefcase, label: 'Background jobs', path: '/admin/jobs', module: 'jobs' },
    ],
  },
  {
    label: 'Business',
    items: [
      { icon: CreditCard, label: 'Subscriptions', path: '/admin/subscriptions', module: 'subscriptions' },
      { icon: Coins, label: 'Plans and pricing', path: '/admin/plans', module: 'plans' },
      { icon: Receipt, label: 'Billing and payments', path: '/admin/billing', module: 'billing' },
      { icon: TrendingUp, label: 'Revenue analytics', path: '/admin/revenue', module: 'revenue' },
    ],
  },
  {
    label: 'AI and support',
    items: [
      { icon: Cpu, label: 'AI management', path: '/admin/ai-usage', module: 'ai-usage' },
      { icon: Key, label: 'API monitoring', path: '/admin/api-usage', module: 'api-usage' },
      { icon: Ticket, label: 'Support tickets', path: '/admin/tickets', module: 'tickets' },
      { icon: Flag, label: 'Announcements', path: '/admin/announcements', module: 'announcements' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: Plug, label: 'Integrations', path: '/admin/integrations', module: 'integrations' },
      { icon: Gauge, label: 'System health', path: '/admin/system-health', module: 'system-health' },
      { icon: Filter, label: 'Feature flags', path: '/admin/feature-flags', module: 'feature-flags' },
      { icon: AlertTriangle, label: 'Error logs', path: '/admin/errors', module: 'errors' },
      { icon: ScrollText, label: 'Audit logs', path: '/admin/audit', module: 'audit' },
      { icon: Webhook, label: 'Webhooks', path: '/admin/webhooks', module: 'webhooks' },
      { icon: Settings, label: 'Global settings', path: '/admin/settings', module: 'settings' },
    ],
  },
];

const navRow = 'flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)]';
const navRowIdle = 'text-muted-foreground hover:text-foreground hover:shadow-[var(--shadow-inset-sm)]';
const navRowActive = 'neu-inset-sm text-accent-foreground';

export function AdminLayout({
  user,
  role,
  permissions,
  children,
}: {
  user: { name: string; email: string };
  role: string;
  permissions: string[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const initials = (user.name || user.email)
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  const isActive = (path: string) => (path === '/admin' ? pathname === '/admin' : pathname.startsWith(path));
  const visibleGroups = adminNav
    .map((group) => ({ ...group, items: group.items.filter((item) => canReadModule(permissions, item.module)) }))
    .filter((group) => group.items.length > 0);

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

  const nav = (
    <nav className="flex-1 overflow-y-auto px-3 py-4 admin-scroll" aria-label="Admin navigation">
      {visibleGroups.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[12px] font-medium text-muted-foreground">{group.label}</p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.path}>
                <HoverPrefetchLink
                  href={item.path}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive(item.path) ? 'page' : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={cn(navRow, isActive(item.path) ? navRowActive : navRowIdle, collapsed && 'justify-center px-2')}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </HoverPrefetchLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <AdminPermissionsProvider permissions={permissions}>
    <div className="admin-theme flex h-screen overflow-hidden bg-background text-foreground">
      <aside className={cn('hidden lg:flex flex-col neu-shell-side relative sidebar-transition flex-shrink-0', collapsed ? 'w-16' : 'w-64')}>
        <div className={cn('flex items-center gap-3 border-b border-border px-4 py-4', collapsed && 'justify-center px-3')}>
          {collapsed ? (
            <Image src="/favicon.png" alt="ColdFox fox logo" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" sizes="36px" />
          ) : (
            <div className="min-w-0 flex-1">
              <span className="flex items-center">
                <Logo height={52} priority />
              </span>
              <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span className="admin-brand-mark" /> Owner console
              </p>
            </div>
          )}
        </div>

        {nav}

        <div className="border-t border-border px-3 py-3">
          {!collapsed && (
            <div className="mx-1 mb-2 rounded-[10px] neu-inset-sm px-3 py-2">
              <p className="text-[12px] font-medium text-foreground">{role.replace(/_/g, ' ')}</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{user.email}</p>
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

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="admin-theme relative flex h-full w-72 max-w-[85vw] flex-col bg-sidebar shadow-[var(--shadow-raised-lg)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <Logo height={44} />
              <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-[8px] p-1.5 text-muted-foreground hover:bg-muted">
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4 neu-shell-header lg:px-6">
          <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted lg:hidden">
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
            <span className="admin-brand-mark" /> ColdFox owner console
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Switch theme`} title={`Theme: ${themeLabel}`}
              className="neu-btn flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground hover:text-foreground">
              {theme === 'light' ? <Sun className="w-4 h-4" /> : theme === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>
            <Link href="/admin/tickets" aria-label="Support tickets" className="hidden h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors duration-[var(--dur)] hover:bg-muted hover:text-foreground sm:flex">
              <Bell className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 border-l border-border pl-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[12px] font-medium text-primary-foreground">
                {initials || 'SA'}
              </span>
              <span className="hidden text-[13px] font-medium text-foreground sm:block">{user.name}</span>
            </div>
          </div>
        </header>
        <main id="main" className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
    </AdminPermissionsProvider>
  );
}
