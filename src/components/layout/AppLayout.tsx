'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Megaphone, Users, Mail, Inbox, Wand2,
  FileText, BarChart2, Zap, Shield, Ban, HelpCircle, Settings,
  ChevronLeft, ChevronRight, Bell, Search, Sun, Moon, Monitor, User,
  LogOut, ChevronsUpDown, Sparkles, Menu, ShieldCheck, ArrowRight
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { ActiveOrganization, SessionUser, ShellNotification } from '@/lib/types';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/app' },
  { icon: Megaphone, label: 'Campaigns', path: '/app/campaigns' },
  { icon: Users, label: 'Leads & CRM', path: '/app/leads' },
  { icon: Mail, label: 'Mailboxes', path: '/app/mailboxes' },
  { icon: Inbox, label: 'Unified Inbox', path: '/app/inbox' },
  { icon: Wand2, label: 'AI Email Writer', path: '/app/ai-writer' },
  { icon: FileText, label: 'Templates', path: '/app/templates' },
  { icon: BarChart2, label: 'Analytics', path: '/app/analytics' },
  { icon: Zap, label: 'Automations', path: '/app/automations' },
  { icon: Shield, label: 'Deliverability', path: '/app/deliverability' },
  { icon: Ban, label: 'Suppression List', path: '/app/suppression' },
];

const bottomItems = [
  { icon: HelpCircle, label: 'Support', path: '/app/support' },
  { icon: Settings, label: 'Settings', path: '/app/settings' },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} day${Math.round(hours / 24) === 1 ? '' : 's'} ago`;
}

export function AppLayout({
  user,
  organization,
  notifications,
  isPlatformAdmin,
  children,
}: {
  user: SessionUser;
  organization: ActiveOrganization;
  notifications: ShellNotification[];
  isPlatformAdmin: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const unread = notifications.filter(n => !n.readAt).length;
  const initials = (user.name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('');

  const isActive = (path: string) => {
    if (path === '/app') return pathname === '/app';
    return pathname.startsWith(path);
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // still redirect - middleware will re-evaluate the session
    }
    router.replace('/login');
    router.refresh();
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/app/leads?q=${encodeURIComponent(q)}` : '/app/leads');
  };

  const markNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/read', { method: 'POST' });
      router.refresh();
    } catch {
      // non-critical
    }
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };
  const themeLabel = theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'System mode';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={cn('flex items-center gap-3 px-4 py-4 border-b border-border', collapsed && 'justify-center px-3')}>
        {collapsed ? (
          <Image src="/favicon.png" alt="ColdFox fox logo" width={32} height={32} className="h-8 w-8 shrink-0 rounded-full shadow-[var(--neu-elevated-sm)]" />
        ) : (
          <span className="min-w-0 flex-1 rounded-xl bg-white p-1 shadow-[var(--neu-elevated-sm)]">
            <Image src="/logo.png" alt="ColdFox - Smarter Cold Email Outreach" width={160} height={40} className="h-8 w-auto max-w-full" />
          </span>
        )}
        {!collapsed && (
          <p className="sr-only">{organization.name}</p>
        )}
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto" aria-label="Workspace navigation">
        {navItems.map(item => (
          <Link key={item.path} href={item.path} onClick={() => setMobileOpen(false)}
            aria-current={isActive(item.path) ? 'page' : undefined}
            className={cn('flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
              isActive(item.path) ? 'neu-inset-sm text-accent-foreground' : 'text-muted-foreground hover:shadow-[var(--neu-inset-sm)] hover:text-foreground',
              collapsed && 'justify-center px-2')}
            title={collapsed ? item.label : undefined}>
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
        {isPlatformAdmin && (
          <Link href="/admin" onClick={() => setMobileOpen(false)}
            className={cn('flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20', collapsed && 'justify-center px-2')}>
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Platform admin</span>}
          </Link>
        )}
      </nav>

      <div className="px-2 pb-3 border-t border-border pt-2 space-y-0.5">
        {bottomItems.map(item => (
          <Link key={item.path} href={item.path} onClick={() => setMobileOpen(false)}
            aria-current={isActive(item.path) ? 'page' : undefined}
            className={cn('flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
              isActive(item.path) ? 'neu-inset-sm text-accent-foreground' : 'text-muted-foreground hover:shadow-[var(--neu-inset-sm)] hover:text-foreground',
              collapsed && 'justify-center px-2')}>
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        <div className={cn('flex items-center gap-3 px-3 py-2 mt-1 rounded-xl cursor-pointer hover:bg-muted transition-all', collapsed && 'justify-center px-2')}
          onClick={() => setUserMenuOpen(!userMenuOpen)} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setUserMenuOpen(!userMenuOpen); }}
          aria-expanded={userMenuOpen}>
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-[var(--neu-elevated-sm)]">
            <span className="text-white text-xs font-bold">{initials || 'CF'}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{organization.planName} plan</p>
            </div>
          )}
          {!collapsed && <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
        {userMenuOpen && !collapsed && (
          <div className="mx-2 mt-1 neu-card rounded-xl py-1 text-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Link href="/app/settings" className="flex items-center gap-2 px-3 py-2 hover:bg-muted text-foreground" onClick={() => setUserMenuOpen(false)}>
              <User className="w-4 h-4 text-muted-foreground" /> Profile & settings
            </Link>
            <button onClick={signOut} disabled={signingOut} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-red-600 disabled:opacity-60">
              <LogOut className="w-4 h-4" /> {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className={cn('hidden lg:flex flex-col neu-shell-side relative sidebar-transition flex-shrink-0', collapsed ? 'w-16' : 'w-60')}>
        <SidebarContent />
        <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm hover:shadow-md transition-all z-10">
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border z-50 overflow-y-auto">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 h-14 px-4 neu-shell-header flex-shrink-0">
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          <form onSubmit={submitSearch} className="flex-1 max-w-xs hidden sm:flex" role="search">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads…"
                aria-label="Search leads" className="w-full pl-9 pr-4 py-1.5 text-sm neu-inset-sm rounded-xl focus:border-ring focus:outline-none transition-all" />
            </div>
          </form>

          <div className="flex items-center gap-1 ml-auto">
            <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Switch theme`} title={`Theme: ${themeLabel}`}
              className="neu-btn w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground">
              {theme === 'light' ? <Sun className="w-4 h-4" /> : theme === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen && unread > 0) void markNotificationsRead(); }}
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={notifOpen}
                className="neu-btn w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground relative">
                <Bell className="w-4 h-4" />
                {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border border-card" />}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 neu-card rounded-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                    <p className="font-semibold text-sm">Notifications</p>
                    <span className="text-[11px] text-muted-foreground">{unread} unread</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground">You&apos;re all caught up.</p>
                  ) : notifications.slice(0, 6).map(n => (
                    <Link key={n.id} href={n.link || '/app'} onClick={() => setNotifOpen(false)} className="flex items-start gap-3 px-4 py-3 hover:bg-muted cursor-pointer">
                      <span className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', n.readAt ? 'bg-slate-300' : 'bg-blue-500')} />
                      <div className="min-w-0">
                        <p className="text-sm text-foreground">{n.title}</p>
                        {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                        <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                    </Link>
                  ))}
                  <Link href="/app/settings" onClick={() => setNotifOpen(false)} className="flex items-center justify-between px-4 py-2 text-xs font-medium text-primary border-t border-border">
                    Notification settings <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>

            <Link href="/app/support" aria-label="Help and support" className="w-8 h-8 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all">
              <HelpCircle className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <main id="main" className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
