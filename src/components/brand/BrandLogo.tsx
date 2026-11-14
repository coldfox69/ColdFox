import { Server } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Authentic third-party marks, kept as local assets so they are never
 * recoloured, stretched, or approximated by a generic icon.
 *
 * Sources:
 * - Google "G": Wikimedia Commons, Google LLC brand asset.
 * - Gmail: Wikimedia Commons, Google LLC brand asset (2020 icon).
 * - Microsoft: Wikimedia Commons, Microsoft Corporation four-square mark.
 * - Microsoft Outlook: Wikimedia Commons, Microsoft Corporation mark.
 *
 * Only providers ColdFox actually supports are listed.
 */
export const BRANDS = {
  gmail: { src: '/brands/gmail.svg', label: 'Gmail' },
  outlook: { src: '/brands/outlook.svg', label: 'Microsoft Outlook' },
  google: { src: '/brands/google-g.svg', label: 'Google' },
  microsoft: { src: '/brands/microsoft.svg', label: 'Microsoft' },
  supabase: { src: '/brands/supabase.svg', label: 'Supabase' },
} as const;

export type BrandKey = keyof typeof BRANDS;

export function BrandLogo({
  brand,
  size = 20,
  className,
  decorative = false,
}: {
  brand: BrandKey;
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const asset = BRANDS[brand];
  return (
    <img
      src={asset.src}
      alt={decorative ? '' : asset.label}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn('shrink-0 object-contain', className)}
      style={{ width: size, height: size }}
    />
  );
}

export type MailboxProvider = 'gmail' | 'outlook' | 'smtp';

/**
 * The mark shown for a sending mailbox. Gmail and Outlook use their real
 * logos; SMTP is provider-neutral, so it gets a neutral server glyph rather
 * than an invented brand.
 */
export function ProviderMark({
  provider,
  size = 20,
  className,
  decorative = false,
}: {
  provider: MailboxProvider;
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  if (provider === 'gmail') return <BrandLogo brand="gmail" size={size} className={className} decorative={decorative} />;
  if (provider === 'outlook') return <BrandLogo brand="outlook" size={size} className={className} decorative={decorative} />;
  return <Server className={cn('shrink-0 text-muted-foreground', className)} style={{ width: size, height: size }} aria-hidden={decorative || undefined} />;
}
