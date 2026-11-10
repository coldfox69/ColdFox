import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Background job queue.
 *
 * Slow work is written to the existing `background_jobs` table instead of
 * being done inside a request. A worker (the cron route) claims the due jobs
 * one at a time and runs them.
 *
 * Claiming is a compare-and-swap: the row is only taken over when it is still
 * `queued`, so two workers can never run the same job. A job whose worker
 * died is returned to the queue once its lock goes stale.
 */

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface JobRecord {
  id: string;
  organization_id: string | null;
  job_type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  run_at: string;
  attempts: number;
  max_attempts: number;
  idempotency_key: string | null;
}

export interface JobContext {
  id: string;
  organizationId: string | null;
  jobType: string;
  attempts: number;
  payload: Record<string, unknown>;
}

export type JobHandler = (context: JobContext) => Promise<void>;

const handlers = new Map<string, JobHandler>();

/** Register the handler that runs a given job type. */
export function registerJobHandler(jobType: string, handler: JobHandler) {
  handlers.set(jobType, handler);
}

function workerId() {
  return `${process.env.VERCEL_REGION ?? 'local'}-${process.pid ?? 0}`;
}

/**
 * Put a job on the queue. Returns the job id.
 *
 * When `idempotencyKey` is given and a job with that key is already waiting,
 * the existing job is returned instead of adding a duplicate.
 */
export async function enqueueJob(input: {
  jobType: string;
  organizationId?: string | null;
  payload?: Record<string, unknown>;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string;
}): Promise<string> {
  const db = createServiceClient();

  if (input.idempotencyKey) {
    const { data: existing } = await db
      .from('background_jobs')
      .select('id, status')
      .eq('idempotency_key', input.idempotencyKey)
      .in('status', ['queued', 'processing'])
      .maybeSingle();
    if (existing) return existing.id as string;
  }

  const { data, error } = await db
    .from('background_jobs')
    .insert({
      organization_id: input.organizationId ?? null,
      job_type: input.jobType,
      payload: input.payload ?? {},
      status: 'queued',
      priority: input.priority ?? 0,
      run_at: (input.runAt ?? new Date()).toISOString(),
      attempts: 0,
      max_attempts: input.maxAttempts ?? 5,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Could not queue the job: ${error.message}`);
  return data.id as string;
}

/**
 * Take the next due job. Returns null when the queue is empty.
 */
export async function claimJob(): Promise<JobRecord | null> {
  const db = createServiceClient();
  const now = new Date().toISOString();

  const { data: candidate } = await db
    .from('background_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('run_at', now)
    .order('priority', { ascending: false })
    .order('run_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!candidate) return null;

  // Compare-and-swap: the update only applies while the row is still queued.
  const { data: claimed } = await db
    .from('background_jobs')
    .update({
      status: 'processing',
      locked_at: now,
      locked_by: workerId(),
      attempts: Number(candidate.attempts ?? 0) + 1,
      updated_at: now,
    })
    .eq('id', candidate.id)
    .eq('status', 'queued')
    .select('*')
    .maybeSingle();

  return (claimed as JobRecord | null) ?? null;
}

/** Mark a job as finished. */
export async function completeJob(jobId: string) {
  const db = createServiceClient();
  await db
    .from('background_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
}

/**
 * Record a failure. The job goes back on the queue while it still has
 * attempts left, with a backoff, and is marked failed once they run out.
 * A permanent failure skips the retries.
 */
export async function failJob(jobId: string, message: string, maxAttempts = 5, permanent = false) {
  const db = createServiceClient();
  const now = new Date().toISOString();

  const { data: job } = await db
    .from('background_jobs')
    .select('attempts, max_attempts')
    .eq('id', jobId)
    .maybeSingle();

  const attempts = Number.isFinite(Number(job?.attempts)) ? Number(job?.attempts) : 1;
  const limit = Number.isFinite(Number(job?.max_attempts)) ? Number(job?.max_attempts) : maxAttempts;
  const canRetry = !permanent && attempts < limit;

  // Backoff: 30s, 60s, 120s, ...
  const backoffSeconds = Math.min(30 * 2 ** Math.max(0, attempts - 1), 900);

  await db
    .from('background_jobs')
    .update({
      status: canRetry ? 'queued' : 'failed',
      last_error: message.slice(0, 1000),
      locked_at: null,
      locked_by: null,
      run_at: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
      completed_at: canRetry ? null : now,
      updated_at: now,
    })
    .eq('id', jobId);

  await db.from('background_job_logs').insert({
    job_id: jobId,
    level: canRetry ? 'warn' : 'error',
    message: message.slice(0, 1000),
    metadata: { attempts, retrying: canRetry },
  });
}

/** Put jobs whose worker died back on the queue. */
export async function recoverStaleJobs(staleAfterMs = 10 * 60 * 1000) {
  const db = createServiceClient();
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const { data } = await db
    .from('background_jobs')
    .update({
      status: 'queued',
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('locked_at', cutoff)
    .select('id');
  return data?.length ?? 0;
}

export interface QueueRunSummary {
  processed: number;
  completed: number;
  failed: number;
  skipped: number;
}

/**
 * Drain the queue. Each job is claimed and run one at a time; a failing job
 * never stops the ones behind it.
 */
export async function runQueuedJobs(options: { limit?: number } = {}): Promise<QueueRunSummary> {
  const limit = options.limit ?? 10;
  const summary: QueueRunSummary = { processed: 0, completed: 0, failed: 0, skipped: 0 };

  await recoverStaleJobs();

  for (let i = 0; i < limit; i += 1) {
    const job = await claimJob();
    if (!job) break;
    summary.processed += 1;

    const handler = handlers.get(job.job_type);
    if (!handler) {
      summary.skipped += 1;
      // Permanent: there is nothing to retry, the handler does not exist.
      await failJob(job.id, `No handler is registered for job type "${job.job_type}".`, job.max_attempts, true);
      continue;
    }

    try {
      await handler({
        id: job.id,
        organizationId: job.organization_id,
        jobType: job.job_type,
        attempts: job.attempts,
        payload: job.payload ?? {},
      });
      summary.completed += 1;
      await completeJob(job.id);
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await failJob(job.id, message, job.max_attempts);
    }
  }

  return summary;
}
