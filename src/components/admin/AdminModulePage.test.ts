import { describe, it, expect } from 'vitest';
import { toRows } from '@/components/admin/AdminModulePage';

const columns = [
  { key: 'organizations', label: 'Organizations' },
  { key: 'users', label: 'Users' },
];

describe('admin module row normalisation', () => {
  it('returns array payloads untouched', () => {
    const rows = toRows([{ id: 'a' }, { id: 'b' }], undefined, columns);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('a');
  });

  it('extracts the totals summary from the overview payload', () => {
    const payload = {
      totals: { organizations: 3, users: 12 },
      campaignStatuses: { active: 2 },
    };
    const rows = toRows(payload, 'totals', columns);
    expect(rows).toHaveLength(1);
    expect(rows[0].organizations).toBe('3');
    expect(rows[0].users).toBe('12');
  });

  it('flattens a summary object without a rows key', () => {
    const payload = { jobs: { queued: 4 }, errorsLast24h: 0 };
    const rows = toRows(payload, undefined, [{ key: 'jobs', label: 'Jobs' }, { key: 'errorsLast24h', label: 'Errors' }]);
    expect(rows).toHaveLength(1);
    expect(String(rows[0].jobs)).toContain('queued: 4');
    expect(rows[0].errorsLast24h).toBe('0');
  });

  it('extracts a nested list for the admin roles module', () => {
    const payload = {
      roles: [{ key: 'admin' }],
      admins: [{ user_id: 'u1', role: 'super_admin' }],
    };
    const rows = toRows(payload, 'admins', [{ key: 'user_id', label: 'User ID' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe('u1');
  });

  it('never throws on unexpected payloads', () => {
    expect(toRows(null, undefined, columns)).toEqual([]);
    expect(toRows(undefined, 'totals', columns)).toEqual([]);
    expect(toRows('nope', undefined, columns)).toEqual([]);
    expect(toRows(42, undefined, columns)).toEqual([]);
  });
});
