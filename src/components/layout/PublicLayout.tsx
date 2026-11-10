'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Menu, X, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';

const navLinks = [
  { label: 'Features', path: '/features' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'About', path: '/about' },
  { label: 'Contact', path: '/contact' },
  { label: 'FAQ', path: '/faq' },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 16);
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };
  const themeLabel = theme === 'light' ? 'Light mode' : theme === 'dark' ? 'Dark mode' : 'System mode';

  return (
    <header className={cn(
      'fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-[var(--dur-slow)] ease-[var(--ease)]',
      scrolled ? 'neu-shell-header' : 'bg-transparent'
    )}>
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <div className="flex h-16 items-center gap-8">
          <Link href="/" className="flex items-center" aria-label="ColdFox home">
            <Image src="/logo.png" alt="ColdFox - Smarter Cold Email Outreach" width={220} height={55} style={{ height: '48px', width: 'auto' }} className="shrink-0" priority />
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map(link => (
              <Link key={link.path} href={link.path}
                aria-current={pathname === link.path ? 'page' : undefined}
                className={cn('rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-[var(--dur)] ease-[var(--ease)]',
                  pathname === link.path ? 'neu-inset-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Switch theme`} title={`Theme: ${themeLabel}`}
              className="neu-btn flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground hover:text-foreground">
              {theme === 'light' ? <Sun className="w-4 h-4" /> : theme === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>
            <Link href="/login" className="hidden px-2 py-2 text-sm font-medium text-muted-foreground transition-colors duration-[var(--dur)] hover:text-foreground sm:block">
              Sign in
            </Link>
            <Link href="/signup" className="inline-flex h-9 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)]">
              Create account
            </Link>
            <button className="md:hidden rounded-[10px] p-2 text-muted-foreground transition-colors duration-[var(--dur)] hover:bg-muted" aria-label="Toggle navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="space-y-1 border-t border-border bg-card px-6 py-3 md:hidden">
          {navLinks.map(link => (
            <Link key={link.path} href={link.path} onClick={() => setMobileOpen(false)}
              className="block rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-[var(--dur)] hover:bg-muted hover:text-foreground">
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 border-t border-border pt-3">
            <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 rounded-[10px] border border-border py-2 text-center text-sm font-medium text-foreground">Sign in</Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)} className="flex-1 rounded-[10px] bg-primary py-2 text-center text-sm font-medium text-primary-foreground">Create account</Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const footerLinks = {
    Product: [
      { label: 'Features', path: '/features' },
      { label: 'Pricing', path: '/pricing' },
      { label: 'FAQ', path: '/faq' },
    ],
    Company: [
      { label: 'About', path: '/about' },
      { label: 'Contact', path: '/contact' },
    ],
    Legal: [
      { label: 'Privacy policy', path: '/privacy' },
      { label: 'Terms of service', path: '/terms' },
      { label: 'Acceptable use', path: '/acceptable-use' },
    ],
    Account: [
      { label: 'Sign in', path: '/login' },
      { label: 'Create account', path: '/signup' },
    ],
  };

  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="mx-auto max-w-[1200px] px-6 py-12 sm:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center">
              <Image src="/logo.png" alt="ColdFox - Smarter Cold Email Outreach" width={180} height={45} style={{ height: '44px', width: 'auto' }} />
            </Link>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
              Cold email workspace. Import leads, connect your own mailbox, run sequences, handle replies.
            </p>
          </div>
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p className="mb-3 text-[13px] font-medium text-foreground">{section}</p>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.path}>
                    <Link href={link.path} className="text-[13px] text-muted-foreground transition-colors duration-[var(--dur)] hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-[12px] text-muted-foreground">© {new Date().getFullYear()} ColdFox</p>
          <Link href="/unsubscribe" className="text-[12px] text-muted-foreground transition-colors duration-[var(--dur)] hover:text-foreground">
            Unsubscribe from emails
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />
      <main id="main">{children}</main>
      <PublicFooter />
    </div>
  );
}
