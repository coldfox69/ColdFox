import { describe, expect, it, vi } from 'vitest';
import { chunk, fetchAllRows } from '@/lib/data/paginate';

describe('chunk', () => {
  it('splits a list into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 10)).toEqual([]);
    expect(chunk([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe('fetchAllRows', () => {
  it('pages until the last short page', async () => {
    const all = Array.from({ length: 2500 }, (_, index) => index);
    const build = vi.fn(async (from: number, to: number) => ({ data: all.slice(from, to + 1), error: null }));
    const rows = await fetchAllRows(build, { pageSize: 1000 });
    expect(rows).toHaveLength(2500);
    expect(rows[0]).toBe(0);
    expect(rows[2499]).toBe(2499);
    expect(build).toHaveBeenCalledTimes(3);
    expect(build).toHaveBeenNthCalledWith(1, 0, 999);
    expect(build).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  it('never asks for more than one PostgREST page at a time', async () => {
    const build = vi.fn(async (from: number, to: number) => ({ data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null }));
    await fetchAllRows(build, { pageSize: 5000, maxRows: 1500 });
    expect(build).toHaveBeenCalledTimes(2);
    expect(build).toHaveBeenNthCalledWith(1, 0, 999);
    expect(build).toHaveBeenNthCalledWith(2, 1000, 1499);
  });

  it('stops at maxRows', async () => {
    const build = vi.fn(async (from: number, to: number) => ({ data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null }));
    const rows = await fetchAllRows(build, { pageSize: 1000, maxRows: 1200 });
    expect(rows).toHaveLength(1200);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('throws a query error instead of returning partial data', async () => {
    const error = { message: 'boom' } as never;
    await expect(fetchAllRows(async () => ({ data: null, error }))).rejects.toBe(error);
  });
});
