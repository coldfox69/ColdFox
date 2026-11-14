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
  LogOut, ChevronsUpDown, Menu, ShieldCheck, ArrowRight, Rows3, Bot, X,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { HoverPrefetchLink } from '@/components/shared/HoverPrefetchLink';
import { Logo } from '@/components/shared/Logo';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import type { ActiveOrganization, SessionUser, ShellNotification } from '@/lib/types';

type NavItem = { icon: typeof LayoutDashboard; label: string; path: string; hint?: string };

/**
 * Grouped by the job a user is trying to do, in the order they usually do it:
 * understand the workspace, build an audience, write, send, then measure.
 * Every route stays reachable; nothing is hidden behind a second level.
 */
const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Start here',
    items: [
      { icon: LayoutDashboard, label: 'Overview', path: '/app', hint: 'Your workspace at a glance' },
    ],
  },
  {
    label: 'Outreach',
    items: [
      { icon: Users, label: 'Leads & CRM', path: '/app/leads', hint: 'People you contact' },
      { icon: Rows3, label: 'Lead lists', path: '/app/lead-lists', hint: 'Imported contact groups' },
      { icon: FileText, label: 'Templates', path: '/app/templates', hint: 'Reusable email copy' },
      { icon: Megaphone, label: 'Campaigns', path: '/app/campaigns', hint: 'Outreach in progress' },
    ],
  },
  {
    label: 'Sending',
    items: [
      { icon: Mail, label: 'Mailboxes', path: '/app/mailboxes', hint: 'Accounts that send email' },
      { icon: Inbox, label: 'Unified inbox', path: '/app/inbox', hint: 'Replies in one place' },
    ],
  },
  {
    label: 'AI & insight',
    items: [
      { icon: Wand2, label: 'AI email writer', path: '/app/ai-writer', hint: 'Draft copy with AI' },
      { icon: Bot, label: 'AI agents', path: '/app/agents', hint: 'Automated assistants' },
      { icon: Zap, label: 'Automations', path: '/app/automations', hint: 'Run agents on a trigger' },
      { icon: BarChart2, label: 'Analytics', path: '/app/analytics', hint: 'Performance over time' },
    ],
  },
  {
    label: 'Trust & safety',
    items: [
      { icon: Shield, label: 'Deliverability', path: '/app/deliverability', hint: 'SPF, DKIM, DMARC' },
      { icon: Ban, label: 'Suppression list', path: '/app/suppression', hint: 'Never-contact addresses' },
    ],
  },
];

const bottomItems: NavItem[] = [
  { icon: HelpCircle, label: 'Support', path: '/app/support' },
  { icon: Settings, label: 'Settings', path: '/app/settings' },
];

const navRow = 'group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-medium transition-[color,background-color] duration-[var(--dur)] ease-[var(--ease)] focus-visible:outline-none';
const navRowIdle = 'text-muted-foreground hover:bg-muted hover:text-foreground';
const navRowActive = 'nav-active font-semibold';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day ago`;
}

type SidebarProps = {
  collapsed: boolean;
  organization: ActiveOrganization;
  user: SessionUser;
  isPlatformAdmin: boolean;
  pathname: string;
  userMenuOpen: boolean;
  signingOut: boolean;
  onToggleMenu: () => void;
  onSignOut: () => void;
};

function SidebarContent({
  collapsed,
  organization,
  user,
  isPlatformAdmin,
  pathname,
  userMenuOpen,
  signingOut,
  onToggleMenu,
  onSignOut,
}: SidebarProps) {
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

  return (
    <div className="flex flex-col h-full">
      <div className={cn('flex items-center gap-3 px-4 py-4', collapsed && 'justify-center px-3')}>
        {collapsed ? (
          <Image src="/favicon.png" alt="ColdFox fox logo" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" sizes="36px" />
        ) : (
          <span className="flex min-w-0 flex-1 items-center">
            <Logo height={52} priority />
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Workspace navigation">
        {navGroups.map((group, index) => (
          <div key={group.label} className={cn(index > 0 && 'mt-5')}>
            {!collapsed && <p className="nav-label">{group.label}</p>}
            {collapsed && index > 0 && <div className="mx-2 mb-2 border-t border-border" />}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const active = isActive(item.path);
                return (
                  <li key={item.path}>
                    <HoverPrefetchLink
                      href={item.path}
                      onClick={() => onToggleMenu()}
                      aria-current={active ? 'page' : undefined}
                      className={cn(navRow, active ? navRowActive : navRowIdle, collapsed && 'justify-center px-2')}
                      title={collapsed ? item.label : item.hint}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </HoverPrefetchLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <ul className="space-y-0.5">
          {bottomItems.map(item => {
            const active = isActive(item.path);
            return (
              <li key={item.path}>
                <HoverPrefetchLink href={item.path} onClick={() => onToggleMenu()}
                  aria-current={active ? 'page' : undefined}
                  className={cn(navRow, active ? navRowActive : navRowIdle, collapsed && 'justify-center px-2')}
                  title={collapsed ? item.label : undefined}>
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </HoverPrefetchLink>
              </li>
            );
          })}
          {isPlatformAdmin && (
            <li>
              <HoverPrefetchLink href="/admin" onClick={() => onToggleMenu()}
                className={cn(navRow, navRowIdle, collapsed && 'justify-center px-2')}
                title={collapsed ? 'Platform admin' : undefined}>
                <ShieldCheck className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span>Platform admin</span>}
              </HoverPrefetchLink>
            </li>
          )}
        </ul>

        <button
          className={cn(navRow, 'mt-2 w-full cursor-pointer text-left text-muted-foreground hover:bg-muted hover:text-foreground', collapsed && 'justify-center px-2')}
          onClick={() => onToggleMenu()}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
            {initials || 'CF'}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{user.name}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{organization.planName} plan</span>
            </span>
          )}
          {!collapsed && <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
        </button>
        {userMenuOpen && !collapsed && (
          <div className="mt-2 overflow-hidden rounded-[12px] border border-border bg-popover py-1 text-[13px] shadow-[var(--shadow-raised)]">
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
            </div>
            <Link href="/app/settings" className="flex items-center gap-2 px-3 py-2 text-foreground transition-colors duration-[var(--dur)] hover:bg-muted" onClick={() => onToggleMenu()}>
              <User className="w-4 h-4 text-muted-foreground" /> Profile and settings
            </Link>
            <button onClick={onSignOut} disabled={signingOut} className="flex w-full items-center gap-2 px-3 py-2 text-destructive transition-colors duration-[var(--dur)] hover:bg-muted disabled:opacity-60">
              <LogOut className="w-4 h-4" /> {signingOut ? 'Signing out' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
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

  const sidebar = (
    <SidebarContent
      collapsed={collapsed}
      organization={organization}
      user={user}
      isPlatformAdmin={isPlatformAdmin}
      pathname={pathname}
      userMenuOpen={userMenuOpen}
      signingOut={signingOut}
      onToggleMenu={() => setMobileOpen(false)}
      onSignOut={signOut}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn('hidden lg:flex flex-col neu-shell-side relative sidebar-transition flex-shrink-0', collapsed ? 'w-[68px]' : 'w-[248px]')}>
        {sidebar}
        <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-7 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-raised-sm)] transition-colors hover:bg-muted hover:text-foreground">
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[#0b1220]/50 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 z-50 w-[280px] overflow-y-auto border-r border-border bg-sidebar shadow-[var(--shadow-raised-lg)]">
            <div className="flex items-center justify-end px-3 pt-2">
              <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 px-4 neu-shell-header lg:px-6">
          <button className="rounded-[10px] p-1.5 text-muted-foreground transition-colors duration-[var(--dur)] hover:bg-muted hover:text-foreground lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          <form onSubmit={submitSearch} className="hidden max-w-sm flex-1 sm:flex" role="search">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads, companies, or emails"
                aria-label="Search leads" className="w-full rounded-[10px] border border-border bg-input py-2 pl-9 pr-3 text-[13px] outline-none transition-[border-color,box-shadow] duration-[var(--dur)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/15" />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Switch theme`} title={`Theme: ${themeLabel}`}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              {theme === 'light' ? <Sun className="w-4 h-4" /> : theme === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>

            <div className="relative">
              <button onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen && unread > 0) void markNotificationsRead(); }}
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} aria-expanded={notifOpen}
                className="relative flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Bell className="w-4 h-4" />
                {unread > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-card" />}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-[14px] border border-border bg-popover py-1 shadow-[var(--shadow-raised-lg)]">
                    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                      <p className="text-[13px] font-semibold">Notifications</p>
                      <span className="text-[12px] text-muted-foreground">{unread} unread</span>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Nothing new</p>
                    ) : notifications.slice(0, 6).map(n => (
                      <Link key={n.id} href={n.link || '/app'} onClick={() => setNotifOpen(false)} className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors duration-[var(--dur)] hover:bg-muted">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-muted-foreground/40' : 'bg-primary')} />
                        <div className="min-w-0">
                          <p className="text-[13px] text-foreground">{n.title}</p>
                          {n.body && <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{n.body}</p>}
                          <p className="mt-0.5 text-[12px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                        </div>
                      </Link>
                    ))}
                    <Link href="/app/settings" onClick={() => setNotifOpen(false)} className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[12px] font-medium text-accent-foreground hover:bg-muted">
                      Notification settings <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </>
              )}
            </div>

            <Link href="/app/support" aria-label="Help and support" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground transition-colors duration-[var(--dur)] hover:bg-muted hover:text-foreground">
              <HelpCircle className="w-4 h-4" />
            </Link>
          </div>
        </header>

        <main id="main" className="app-canvas flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
