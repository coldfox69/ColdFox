import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Source art is 790x316 for both themes; the box keeps that ratio so the
 * lockup sits exactly where the single light-mode asset used to.
 */
const LOGO_WIDTH = 790;
const LOGO_HEIGHT = 316;

/**
 * The ColdFox lockup. Both variants are rendered and the active one is chosen
 * with the `.dark` class the ThemeProvider puts on <html>, so the ink swaps
 * with the theme on first paint instead of after a client-side theme read.
 * The dark variant is the same artwork with its ink inverted, so the navy
 * wordmark and the dark parts of the fox stay readable on dark surfaces.
 */
export function Logo({
  height = 48,
  className,
  priority = false,
}: {
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const width = Math.round((height * LOGO_WIDTH) / LOGO_HEIGHT);

  return (
    <span
      className={cn('relative inline-block shrink-0 align-middle', className)}
      style={{ height, width }}
    >
      <Image
        src="/logo.png"
        alt="ColdFox - Smarter Cold Email Outreach"
        fill
        sizes={`${width}px`}
        priority={priority}
        className="object-contain opacity-100 dark:opacity-0"
      />
      <Image
        src="/logo-dark.png"
        alt=""
        fill
        sizes={`${width}px`}
        priority={priority}
        className="object-contain opacity-0 dark:opacity-100"
      />
    </span>
  );
}
