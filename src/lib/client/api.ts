'use client';

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * In-flight request map. Two components asking for the same GET at the same
 * time share one network request instead of firing two.
 */
const inflight = new Map<string, Promise<unknown>>();

export interface ApiFetchOptions extends RequestInit {
  /** Abort the request after this many milliseconds. Defaults to 20s. */
  timeoutMs?: number;
  /**
   * Share one network request between callers asking for the same
   * method + url. Defaults to true for GET, false for anything that mutates.
   */
  dedupe?: boolean;
}

function dedupeKey(init: RequestInit | undefined, path: string) {
  return `${init?.method ?? 'GET'} ${path}`;
}

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, dedupe, ...rest } = init ?? {};
  const method = (rest.method ?? 'GET').toUpperCase();
  const shouldDedupe = dedupe ?? method === 'GET';

  const run = async (): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    // Respect a caller supplied signal as well.
    const externalSignal = rest.signal ?? undefined;
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onAbort);

    try {
      const response = await fetch(path, {
        ...rest,
        signal: controller.signal,
        headers: {
          ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
          ...rest.headers,
        },
        credentials: 'same-origin',
      });

      let payload: ApiEnvelope<T> | null = null;
      try {
        payload = (await response.json()) as ApiEnvelope<T>;
      } catch {
        // non-JSON response
      }
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `Request failed (${response.status}).`);
      }
      return payload.data as T;
    } catch (error) {
      if (controller.signal.aborted && !externalSignal?.aborted) {
        throw new Error('The request timed out. Please check your connection and try again.');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  };

  if (!shouldDedupe) return run();

  const key = dedupeKey(rest, path);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise as Promise<T>;
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}

/**
 * Consume a server-sent-event stream and call `onEvent` for every event.
 * Used by the AI writer so the draft appears token by token.
 */
export async function apiStream<T>(
  path: string,
  body: unknown,
  onEvent: (event: T) => void,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<void> {
  const { signal, timeoutMs = 60_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      let message = `Request failed (${response.status}).`;
      try {
        const payload = (await response.json()) as ApiEnvelope<unknown>;
        if (payload?.error) message = payload.error;
      } catch {
        // keep the default message
      }
      throw new Error(message);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            onEvent(JSON.parse(payload) as T);
          } catch {
            // ignore malformed event
          }
        }
      }
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Pull a string field out of a partially received JSON object so the UI can
 * render text while the model is still writing.
 */
export function extractPartialJsonString(raw: string, field: string): string {
  const marker = `"${field}"`;
  const keyIndex = raw.indexOf(marker);
  if (keyIndex === -1) return '';
  let index = keyIndex + marker.length;
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  if (raw[index] !== ':') return '';
  index += 1;
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  if (raw[index] !== '"') return '';

  let out = '';
  index += 1;
  while (index < raw.length) {
    const char = raw[index];
    if (char === '\\') {
      const next = raw[index + 1];
      if (next === 'n') out += '\n';
      else if (next === 't') out += '\t';
      else if (next === 'r') out += '\r';
      else if (next === 'b') out += '\b';
      else if (next === 'f') out += '\f';
      else if (next === 'u') {
        out += String.fromCharCode(parseInt(raw.slice(index + 2, index + 6), 16));
        index += 4;
      } else if (next === '"') out += '"';
      else if (next === '\\') out += '\\';
      else if (next === '/') out += '/';
      else out += next;
      index += 2;
      continue;
    }
    if (char === '"') break;
    out += char;
    index += 1;
  }
  return out;
}
