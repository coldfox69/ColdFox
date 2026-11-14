/**
 * Reading more rows than PostgREST returns in one response.
 *
 * Supabase caps a response at `max_rows` (1000 by default), so a query that
 * asks for `.limit(10000)` still only receives 1000 rows. Anything that has to
 * see a whole workspace (recipient builds, exports, dedupe scans) must page
 * through the table with a stable order.
 */

import 'server-only';
import type { PostgrestError } from '@supabase/supabase-js';

/** PostgREST's default `max_rows`. A page larger than this is silently cut. */
export const POSTGREST_PAGE_SIZE = 1000;

export interface PageResult<T> {
  data: T[] | null;
  error: PostgrestError | null;
}

/** Split `items` into arrays of at most `size` entries. */
export function chunk<T>(items: readonly T[], size = 200): T[][] {
  const width = Math.max(1, Math.floor(size));
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += width) {
    batches.push(items.slice(index, index + width));
  }
  return batches;
}

/**
 * Fetch every row of a paginated query.
 *
 * `build` receives the inclusive range to read; it should apply a stable
 * `.order(...)` so pages cannot repeat or skip rows. Paging stops at
 * `maxRows` or at the first short page. A query error is thrown so callers can
 * decide how to surface it.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const pageSize = Math.max(1, Math.min(options.pageSize ?? POSTGREST_PAGE_SIZE, POSTGREST_PAGE_SIZE));
  const maxRows = Math.max(0, Math.floor(options.maxRows ?? Number.MAX_SAFE_INTEGER));
  const rows: T[] = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize, maxRows) - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < to - from + 1) break;
  }

  return rows;
}
