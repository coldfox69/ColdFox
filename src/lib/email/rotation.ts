export interface RotatableVariant {
  id: string;
  variant_order: number;
  subject: string;
  body_text?: string;
  /** Relative weight; higher means it is picked more often. Defaults to 1. */
  weight?: number;
}

/**
 * Deterministic weighted rotation seeded by the execution id.
 *
 * The same recipient always resolves to the same variant, which keeps the
 * pipeline idempotent: a retry or worker restart never silently swaps which
 * message a recipient was going to receive. Over a large batch, the weighted
 * distribution stays balanced without needing a shared counter.
 */
export function pickVariant<T extends RotatableVariant>(variants: T[], seed: string): T | null {
  if (!variants.length) return null;
  const weights = variants.map((variant) => Math.max(1, Number(variant.weight ?? 1)));
  const total = weights.reduce((sum, w) => sum + w, 0);

  // FNV-1a-ish hash of the seed; stable across processes and restarts.
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let pick = (hash >>> 0) % total;
  for (let i = 0; i < variants.length; i += 1) {
    pick -= weights[i];
    if (pick < 0) return variants[i];
  }
  return variants[variants.length - 1];
}

/** Count used by analytics and health checks. */
export function variantDistribution(variants: RotatableVariant[]) {
  const weights = variants.map((variant) => Math.max(1, Number(variant.weight ?? 1)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  return variants.map((variant, index) => ({
    id: variant.id,
    order: variant.variant_order,
    weight: weights[index],
    share: total ? weights[index] / total : 0,
  }));
}
