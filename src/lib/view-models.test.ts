import { describe, it, expect } from 'vitest';
import { pct, toLeadStatus, fromLeadStatus, toCampaignStatus } from '@/lib/view-models';

describe('view model mappers', () => {
  it('pct returns 0 when whole is 0', () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(0, 0)).toBe(0);
  });

  it('pct calculates percentage', () => {
    expect(pct(10, 100)).toBe(10);
    expect(pct(3, 7)).toBeCloseTo(42.9);
  });

  it('maps lead statuses', () => {
    expect(toLeadStatus('not_interested')).toBe('not-interested');
    expect(toLeadStatus('unknown')).toBe('new');
    expect(fromLeadStatus('not-interested')).toBe('not_interested');
  });

  it('maps campaign statuses', () => {
    expect(toCampaignStatus('active')).toBe('active');
    expect(toCampaignStatus('unknown')).toBe('draft');
  });
});
