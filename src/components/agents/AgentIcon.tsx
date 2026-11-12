'use client';

import {
  Bot,
  ShoppingBag,
  Search,
  Rocket,
  Target,
  Globe,
  Sparkles,
  Megaphone,
  Database,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  bot: Bot,
  'shopping-bag': ShoppingBag,
  search: Search,
  rocket: Rocket,
  target: Target,
  globe: Globe,
  sparkles: Sparkles,
  megaphone: Megaphone,
  database: Database,
};

/** Renders the icon an administrator chose for an agent. */
export function AgentIcon({ name, className }: { name?: string | null; className?: string }) {
  const key = (name ?? '').trim().toLowerCase();
  const Icon = ICONS[key] ?? Bot;
  return <Icon className={cn('w-5 h-5', className)} />;
}
