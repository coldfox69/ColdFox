/**
 * Lightweight request tracing for slow backend work.
 *
 * Every server entry point can wrap its work in `withTrace`, which records a
 * span with a name, duration and tags. Spans that exceed the slow threshold are
 * logged and persisted so they can be reviewed later.
 *
 * If an OpenTelemetry collector is configured (`OTEL_EXPORTER_OTLP_ENDPOINT`)
 * the spans are exported over OTLP/HTTP as JSON, so they show up in any
 * OTLP-compatible backend (Jaeger, Tempo, Honeycomb) without pulling in a
 * vendor SDK.
 */
import 'server-only';

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 1500);

export interface Span {
  name: string;
  startedAt: number;
  endedAt?: number;
  attributes: Record<string, string | number | boolean>;
  error?: string;
}

const activeSpans = new Map<string, Span>();

function otlpEndpoint(): string | null {
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!base) return null;
  return base.endsWith('/') ? `${base}v1/traces` : `${base}/v1/traces`;
}

function hex(value: number, length: number) {
  return value.toString(16).padStart(length, '0');
}

function traceId(): string {
  return hex(Date.now() * 1000 + Math.floor(Math.random() * 1000), 32);
}

function spanId(): string {
  return hex(Math.floor(Math.random() * 0xffffffff), 16);
}

function toOtlp(span: Span, trace: string, id: string) {
  const durationNs = Math.max(1, ((span.endedAt ?? Date.now()) - span.startedAt) * 1_000_000);
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: process.env.OTEL_SERVICE_NAME ?? 'coldfox' } },
            { key: 'deployment.environment', value: { stringValue: process.env.NODE_ENV ?? 'production' } },
            { key: 'deployment.region', value: { stringValue: process.env.VERCEL_REGION ?? 'unknown' } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'coldfox' },
            spans: [
              {
                traceId: trace,
                spanId: id,
                name: span.name,
                kind: 2,
                startTimeUnixNano: String(span.startedAt * 1_000_000),
                endTimeUnixNano: String((span.endedAt ?? Date.now()) * 1_000_000),
                durationNano: String(durationNs),
                attributes: Object.entries(span.attributes).map(([key, value]) => ({
                  key,
                  value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: String(value) },
                })),
                status: span.error ? { code: 2, message: span.error } : { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };
}

async function exportSpan(span: Span, trace: string, id: string) {
  const endpoint = otlpEndpoint();
  if (!endpoint) return;
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toOtlp(span, trace, id)),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Telemetry must never break the request path.
  }
}

/**
 * Run `work` while recording a span. Errors are re-thrown after the span is
 * closed, so behaviour is unchanged.
 */
export async function withTrace<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: () => Promise<T>,
): Promise<T> {
  const trace = traceId();
  const id = spanId();
  const span: Span = { name, startedAt: Date.now(), attributes: { ...attributes } };
  activeSpans.set(id, span);
  try {
    const result = await work();
    span.endedAt = Date.now();
    const duration = span.endedAt - span.startedAt;
    if (duration >= SLOW_REQUEST_MS) {
      console.warn(`[trace] slow ${name} ${duration}ms`, span.attributes);
      // Exported without awaiting: a slow request must not also wait for the
      // collector to acknowledge the span.
      void exportSpan(span, trace, id);
    }
    return result;
  } catch (error) {
    span.endedAt = Date.now();
    span.error = error instanceof Error ? error.message : String(error);
    const duration = span.endedAt - span.startedAt;
    if (duration >= SLOW_REQUEST_MS) {
      console.error(`[trace] failed ${name} ${duration}ms`, span.attributes, span.error);
    }
    void exportSpan(span, trace, id);
    throw error;
  } finally {
    activeSpans.delete(id);
  }
}

/** Record a one-off duration measurement (e.g. an external API call). */
export async function traceExternal<T>(name: string, attributes: Record<string, string | number | boolean>, work: () => Promise<T>): Promise<T> {
  return withTrace(name, attributes, work);
}
