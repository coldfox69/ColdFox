'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sparkles, Menu, X, Sun, Moon, Monitor } from 'lucide-react';
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
    const handler = () => setScrolled(window.scrollY > 20);
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
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled ? 'neu-shell-header' : 'bg-transparent'
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ColdFox home">
            <div className="w-8 h-8 rounded-xl gradient-blue flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl text-foreground">ColdFox</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map(link => (
              <Link key={link.path} href={link.path}
                aria-current={pathname === link.path ? 'page' : undefined}
                className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all',
                  pathname === link.path ? 'text-foreground neu-inset-sm' : 'text-muted-foreground hover:text-foreground hover:shadow-[var(--neu-inset-sm)]')}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}. Switch theme`}
              title={`Theme: ${themeLabel}`}
              className="neu-btn w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground">
              {theme === 'light' ? <Sun className="w-4 h-4" /> : theme === 'dark' ? <Moon className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            </button>
            <Link href="/login" className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
              Sign In
            </Link>
            <Link href="/signup" className="bg-primary text-primary-foreground text-sm font-semibold px-5 py-2 rounded-xl shadow-[var(--neu-elevated-sm)] hover:brightness-[1.07] active:shadow-[var(--neu-inset-sm)] transition-all">
              Start Free
            </Link>
            <button className="md:hidden p-2 rounded-lg hover:bg-muted" aria-label="Toggle navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-card border-t border-border px-4 py-3 space-y-1">
          {navLinks.map(link => (
            <Link key={link.path} href={link.path} onClick={() => setMobileOpen(false)}
              className="block px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-border flex gap-2">
            <Link href="/login" onClick={() => setMobileOpen(false)} className="flex-1 text-center py-2 text-sm font-medium text-foreground border border-border rounded-xl hover:bg-muted">Sign In</Link>
            <Link href="/signup" onClick={() => setMobileOpen(false)} className="flex-1 text-center py-2 text-sm font-semibold text-white gradient-blue rounded-xl hover:opacity-90">Start Free</Link>
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
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'Terms of Service', path: '/terms' },
      { label: 'Acceptable Use', path: '/acceptable-use' },
    ],
    Account: [
      { label: 'Sign In', path: '/login' },
      { label: 'Create Account', path: '/signup' },
    ],
  };

  return (
    <footer className="mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl gradient-blue flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-foreground">ColdFox</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              AI-powered cold email outreach platform for modern sales teams.
            </p>
          </div>
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <p className="font-semibold text-sm text-foreground mb-3">{section}</p>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.path}>
                    <Link href={link.path} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ColdFox. All rights reserved.</p>
          <Link href="/unsubscribe" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
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
