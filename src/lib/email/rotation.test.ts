import { describe, expect, it } from 'vitest';
import { pickVariant, variantDistribution } from '@/lib/email/rotation';

const variants = [
  { id: 'a', variant_order: 1, subject: 'A' },
  { id: 'b', variant_order: 2, subject: 'B' },
  { id: 'c', variant_order: 3, subject: 'C' },
];

describe('pickVariant', () => {
  it('returns null with no variants', () => {
    expect(pickVariant([], 'seed')).toBeNull();
  });

  it('is deterministic for the same seed', () => {
    const first = pickVariant(variants, 'campaign:1:lead:9:step:1');
    const second = pickVariant(variants, 'campaign:1:lead:9:step:1');
    expect(first?.id).toBe(second?.id);
  });

  it('selects every variant across many seeds (balanced spread)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 600; i += 1) {
      const picked = pickVariant(variants, `campaign:1:lead:${i}:step:1`);
      if (picked) seen.add(picked.id);
    }
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
  });

  it('respects relative weights within distribution', () => {
    const weighted = [
      { id: 'heavy', variant_order: 1, subject: 'H', weight: 10 },
      { id: 'light', variant_order: 2, subject: 'L', weight: 1 },
    ];
    let heavy = 0;
    const runs = 3000;
    for (let i = 0; i < runs; i += 1) {
      if (pickVariant(weighted, `s:${i}`)?.id === 'heavy') heavy += 1;
    }
    expect(heavy / runs).toBeGreaterThan(0.8);
  });
});

describe('variantDistribution', () => {
  it('reports normalized shares', () => {
    const dist = variantDistribution([...variants.slice(0, 2)]);
    expect(dist.map((d) => d.share)).toEqual([0.5, 0.5]);
  });
});
