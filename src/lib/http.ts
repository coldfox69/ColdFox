import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { getApiSession, type ApiSession } from '@/lib/auth/api-session';
import { withTrace } from '@/lib/telemetry';
import { escapeCsvCell } from '@/lib/csv';
import { createHash } from 'node:crypto';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, message: string, code?: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

export function hashIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(ip + (process.env.UNSUBSCRIBE_TOKEN_SECRET ?? '')).digest('hex').slice(0, 32);
}

/**
 * Wraps every API route handler.
 *
 * The route name and method are recorded on a span so slow backend requests
 * can be traced. The span is logged when it exceeds `SLOW_REQUEST_MS` and is
 * exported over OTLP when a collector is configured.
 */
export async function withApi(
  target: { route: string; method: string },
  handler: () => Promise<Response>,
): Promise<Response> {
  const startedAt = Date.now();
  try {
    const response = await withTrace(
      `api ${target.method} ${target.route}`,
      { 'http.route': target.route, 'http.method': target.method },
      handler,
    );
    // The time the server spent on the route, so a slow request can be
    // identified from the browser or the logs without any extra tooling.
    try {
      response.headers.set('Server-Timing', `app;dur=${Date.now() - startedAt}`);
    } catch {
      // Some responses have immutable headers.
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error.status, error.message, error.code);
    }
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return fail(422, first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', 'validation_error');
    }
    console.error('[api] unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    // Do not leak internals to clients.
    try {
      await createServiceClient().from('error_logs').insert({
        level: 'error',
        message: message.slice(0, 500),
        stack: error instanceof Error ? error.stack?.slice(0, 4000) : null,
        context: { source: 'api' },
      });
    } catch {}
    return fail(500, 'Something went wrong. Please try again.', 'internal_error');
  }
}

export async function requireApiSession(roles?: ApiSession['role'][] | false): Promise<ApiSession> {
  const session = await getApiSession(roles !== false);
  if (!session) throw new ApiError(401, 'Sign in to continue.', 'unauthenticated');
  if (Array.isArray(roles) && !roles.includes(session.role)) {
    throw new ApiError(403, 'You do not have permission to perform this action.', 'forbidden');
  }
  return session;
}

export function assertRole(session: ApiSession, roles: ApiSession['role'][]) {
  if (!roles.includes(session.role)) {
    throw new ApiError(403, 'You do not have permission to perform this action.', 'forbidden');
  }
}

export async function requirePlatformAdmin(permission?: string) {
  const session = await requireApiSession(false);
  const db = createServiceClient();
  const { data: admin } = await db.from('platform_admins').select('role').eq('user_id', session.userId).maybeSingle();
  if (!admin) throw new ApiError(403, 'Platform administrator access is required.', 'forbidden');
  if (permission) {
    const { data: role } = await db.from('admin_roles').select('permissions').eq('key', admin.role).maybeSingle();
    const permissions = (role?.permissions as string[] | undefined) ?? [];
    if (!permissions.includes('*') && !permissions.includes(permission)) {
      throw new ApiError(403, 'You do not have permission to view this admin module.', 'forbidden');
    }
  }
  return { session, role: String(admin.role) };
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'Expected a JSON request body.', 'invalid_json');
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ApiError(422, first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input', 'validation_error');
  }
  return result.data;
}

export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new ApiError(422, first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid query', 'validation_error');
  }
  return result.data;
}

export async function enforceRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number, subject = 'ip') {
  const key = `api:${bucket}:${subject}:${hashIp(request)}`;
  try {
    const { data, error } = await createServiceClient().rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;
    if (data === false) {
      throw new ApiError(429, 'Too many requests. Please slow down and try again shortly.', 'rate_limited');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Rate limiting must not silently disappear, but a transient RPC failure
    // should not lock everyone out. Log and continue.
    console.warn('[rate-limit] failed to apply', error);
  }
}

export async function writeAudit(input: {
  organizationId?: string | null;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  request?: Request;
  metadata?: Record<string, unknown>;
}) {
  try {
    await createServiceClient().from('audit_logs').insert({
      organization_id: input.organizationId ?? null,
      actor_id: input.actorId ?? null,
      actor_email: input.actorEmail ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      ip_hash: input.request ? hashIp(input.request) : null,
      user_agent: input.request?.headers.get('user-agent')?.slice(0, 500) ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (error) {
    console.warn('[audit] failed to write', error);
  }
}

export function csvEscape(value: unknown) {
  return escapeCsvCell(value);
}

export function toCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}
