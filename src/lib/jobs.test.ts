import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * A small in-memory stand-in for the PostgREST client. It supports exactly
 * the operations the queue uses: select, insert, update and delete with
 * eq / in / lte / lt / order / limit filters.
 */
const h = vi.hoisted(() => {
  type Row = Record<string, any>;

  const tables: Record<string, Row[]> = {};
  let counter = 0;

  class FakeQuery {
    private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private payload: any = null;
    private filters: Array<[string, string, any]> = [];
    private orderings: Array<[string, boolean]> = [];
    private limitN: number | null = null;

    constructor(private table: string) {}

    select() {
      return this;
    }
    insert(rows: Row | Row[]) {
      this.op = 'insert';
      this.payload = rows;
      return this;
    }
    update(values: Row) {
      this.op = 'update';
      this.payload = values;
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    eq(column: string, value: any) {
      this.filters.push(['eq', column, value]);
      return this;
    }
    in(column: string, values: any[]) {
      this.filters.push(['in', column, values]);
      return this;
    }
    lte(column: string, value: any) {
      this.filters.push(['lte', column, value]);
      return this;
    }
    lt(column: string, value: any) {
      this.filters.push(['lt', column, value]);
      return this;
    }
    order(column: string, options?: { ascending?: boolean }) {
      this.orderings.push([column, options?.ascending ?? true]);
      return this;
    }
    limit(n: number) {
      this.limitN = n;
      return this;
    }

    private matches(row: Row) {
      return this.filters.every(([kind, column, value]) => {
        if (kind === 'eq') return row[column] === value;
        if (kind === 'in') return Array.isArray(value) && value.includes(row[column]);
        if (kind === 'lte') return row[column] <= value;
        if (kind === 'lt') return row[column] < value;
        return true;
      });
    }

    private matching(): Row[] {
      let rows = (tables[this.table] ?? []).filter((row) => this.matches(row));
      for (const [column, ascending] of [...this.orderings].reverse()) {
        rows = [...rows].sort((a, b) => {
          if (a[column] === b[column]) return 0;
          return (a[column] > b[column] ? 1 : -1) * (ascending ? 1 : -1);
        });
      }
      if (this.limitN !== null) rows = rows.slice(0, this.limitN);
      return rows;
    }

    private async run(): Promise<Row[]> {
      if (this.op === 'insert') {
        const incoming = Array.isArray(this.payload) ? this.payload : [this.payload];
        const created = incoming.map((row) => {
          counter += 1;
          const full = { id: row.id ?? `row-${counter}`, ...row };
          (tables[this.table] ??= []).push(full);
          return full;
        });
        return created;
      }
      if (this.op === 'update') {
        const rows = this.matching();
        for (const row of rows) Object.assign(row, this.payload);
        return rows;
      }
      if (this.op === 'delete') {
        const rows = this.matching();
        const ids = new Set(rows.map((row) => row.id));
        tables[this.table] = (tables[this.table] ?? []).filter((row) => !ids.has(row.id));
        return rows;
      }
      return this.matching();
    }

    async maybeSingle() {
      const rows = await this.run();
      return { data: rows[0] ?? null, error: null };
    }
    async single() {
      const rows = await this.run();
      return { data: rows[0] ?? null, error: null };
    }
    then(onFulfilled: any, onRejected: any) {
      return this.run().then(
        (rows) => ({ data: rows, error: null }),
        onRejected,
      ).then(onFulfilled, onRejected);
    }
  }

  return {
    tables,
    fakeClient: {
      from: (table: string) => new FakeQuery(table),
    },
    reset() {
      for (const key of Object.keys(tables)) delete tables[key];
      counter = 0;
    },
  };
});

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => h.fakeClient,
}));

type JobsModule = typeof import('@/lib/jobs');
let jobs: JobsModule;

beforeEach(async () => {
  h.reset();
  vi.resetModules();
  jobs = await import('@/lib/jobs');
});

describe('background job queue', () => {
  it('enqueues a job in the queued state', async () => {
    const id = await jobs.enqueueJob({ jobType: 'inbox.sync', organizationId: 'org-1' });
    const row = h.tables['background_jobs'][0];
    expect(row.id).toBe(id);
    expect(row.status).toBe('queued');
    expect(row.job_type).toBe('inbox.sync');
    expect(row.attempts).toBe(0);
  });

  it('does not queue a second job when an idempotency key is already waiting', async () => {
    const first = await jobs.enqueueJob({ jobType: 'inbox.sync', idempotencyKey: 'k1' });
    const second = await jobs.enqueueJob({ jobType: 'inbox.sync', idempotencyKey: 'k1' });
    expect(second).toBe(first);
    expect(h.tables['background_jobs']).toHaveLength(1);
  });

  it('claims the highest priority due job and counts the attempt', async () => {
    await jobs.enqueueJob({ jobType: 'low', priority: 0, runAt: new Date(Date.now() - 1000) });
    await jobs.enqueueJob({ jobType: 'high', priority: 10, runAt: new Date(Date.now() - 1000) });

    const claimed = await jobs.claimJob();
    expect(claimed?.job_type).toBe('high');
    expect(claimed?.status).toBe('processing');
    expect(claimed?.attempts).toBe(1);
  });

  it('does not claim a job that is not due yet', async () => {
    await jobs.enqueueJob({ jobType: 'later', runAt: new Date(Date.now() + 60_000) });
    expect(await jobs.claimJob()).toBeNull();
  });

  it('returns null when the queue is empty', async () => {
    expect(await jobs.claimJob()).toBeNull();
  });

  it('runs the registered handler and marks the job completed', async () => {
    const seen: string[] = [];
    jobs.registerJobHandler('demo', async (job) => {
      seen.push(job.payload.name as string);
    });
    await jobs.enqueueJob({ jobType: 'demo', payload: { name: 'alpha' } });

    const summary = await jobs.runQueuedJobs();
    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(0);
    expect(seen).toEqual(['alpha']);
    expect(h.tables['background_jobs'][0].status).toBe('completed');
  });

  it('retries a failing job instead of losing it', async () => {
    let calls = 0;
    jobs.registerJobHandler('flaky', async () => {
      calls += 1;
      throw new Error('provider is down');
    });
    await jobs.enqueueJob({ jobType: 'flaky', maxAttempts: 3 });

    const summary = await jobs.runQueuedJobs();
    expect(summary.failed).toBe(1);
    const row = h.tables['background_jobs'][0];
    expect(row.status).toBe('queued');
    expect(row.attempts).toBe(1);
    expect(row.last_error).toContain('provider is down');
    expect(calls).toBe(1);
  });

  it('gives up once the attempts are used up', async () => {
    jobs.registerJobHandler('always-fails', async () => {
      throw new Error('nope');
    });
    await jobs.enqueueJob({ jobType: 'always-fails', maxAttempts: 1 });

    await jobs.runQueuedJobs();
    const row = h.tables['background_jobs'][0];
    expect(row.status).toBe('failed');
    expect(row.completed_at).toBeTruthy();
  });

  it('does not stop the queue when one job fails', async () => {
    jobs.registerJobHandler('bad', async () => {
      throw new Error('bad');
    });
    jobs.registerJobHandler('good', async () => undefined);
    await jobs.enqueueJob({ jobType: 'bad', maxAttempts: 1 });
    await jobs.enqueueJob({ jobType: 'good', maxAttempts: 1 });

    const summary = await jobs.runQueuedJobs();
    expect(summary.processed).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it('marks a job with no handler as failed', async () => {
    await jobs.enqueueJob({ jobType: 'unknown-type' });
    const summary = await jobs.runQueuedJobs();
    expect(summary.skipped).toBe(1);
    expect(h.tables['background_jobs'][0].status).toBe('failed');
  });

  it('returns a job whose worker died to the queue', async () => {
    h.tables['background_jobs'] = [
      {
        id: 'stuck',
        job_type: 'demo',
        status: 'processing',
        locked_at: new Date(Date.now() - 30 * 60_000).toISOString(),
        attempts: 1,
        max_attempts: 5,
      },
    ];
    const recovered = await jobs.recoverStaleJobs();
    expect(recovered).toBe(1);
    expect(h.tables['background_jobs'][0].status).toBe('queued');
    expect(h.tables['background_jobs'][0].locked_at).toBeNull();
  });
});
