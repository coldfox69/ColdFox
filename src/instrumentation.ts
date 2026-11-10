import { type Instrumentation } from 'next';

/**
 * Server instrumentation.
 *
 * `register` runs once when a server instance starts. `onRequestError` catches
 * the errors that escape the route handlers (React Server Component render
 * errors, for example) so nothing fails silently.
 */

/**
 * The tracing layer is dependency-free and reads its configuration lazily, so
 * there is nothing to install here. This hook exists so the server can report
 * that tracing is wired up, and so a collector can be registered later without
 * touching the request path.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    console.log('[instrumentation] tracing enabled, exporting to', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined;

  console.error('[instrumentation] request failed', {
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
    routerKind: context.routerKind,
    digest,
    message,
  });

  // Persist it so failures that happen outside the API handlers are still
  // visible in the admin error log.
  try {
    const { createServiceClient } = await import('@/lib/supabase/service');
    await createServiceClient().from('error_logs').insert({
      level: 'error',
      message: message.slice(0, 500),
      stack: err instanceof Error ? err.stack?.slice(0, 4000) : null,
      context: {
        source: 'instrumentation',
        path: request.path,
        method: request.method,
        routeType: context.routeType,
        routePath: context.routePath,
        routerKind: context.routerKind,
        digest: digest ?? null,
      },
    });
  } catch {
    // Never let error reporting break the response.
  }
};
