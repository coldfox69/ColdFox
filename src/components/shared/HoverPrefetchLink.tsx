'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

/**
 * A link that only prefetches once the user shows intent for it.
 *
 * The default `<Link>` prefetches every link that enters the viewport. A
 * sidebar with a dozen always-visible routes therefore fired a server request
 * per route on every page load, which on a slow connection competed with the
 * page itself for bandwidth.
 *
 * Prefetching on hover keeps the route warm for the click, but only for the
 * link the user is actually about to open. The `onFocus` handler covers
 * keyboard navigation.
 */
export function HoverPrefetchLink({
  href,
  children,
  className,
  title,
  'aria-current': ariaCurrent,
  'aria-label': ariaLabel,
  onClick,
  onFocus,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  title?: string;
  'aria-current'?: 'page' | undefined;
  'aria-label'?: string;
  onClick?: () => void;
  onFocus?: () => void;
}) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      href={href}
      prefetch={intent ? null : false}
      className={className}
      title={title}
      aria-current={ariaCurrent}
      aria-label={ariaLabel}
      onMouseEnter={() => setIntent(true)}
      onTouchStart={() => setIntent(true)}
      onFocus={() => {
        setIntent(true);
        onFocus?.();
      }}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
