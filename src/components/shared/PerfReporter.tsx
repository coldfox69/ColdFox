'use client';

import { useReportWebVitals } from 'next/web-vitals';

/**
 * Real-user speed reporting.
 *
 * Next.js measures the Core Web Vitals (TTFB, FCP, LCP, CLS, INP) plus its own
 * hydration and route-change timings, and hands them to this callback. The
 * report is sent with `sendBeacon` so it never blocks navigation, and the
 * payload is tiny. No third-party script is loaded.
 *
 * The callback has to keep a stable reference, so it lives at module scope.
 */
function reportVital(metric: {
  name: string;
  value: number;
  rating?: string;
  id?: string;
  navigationType?: string;
}) {
  if (typeof window === 'undefined') return;

  const body = JSON.stringify({
    path: window.location.pathname,
    metric: metric.name,
    value: Math.round(metric.value * 100) / 100,
    rating: metric.rating ?? null,
    navigationType: metric.navigationType ?? null,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/perf/beacon', new Blob([body], { type: 'application/json' }));
      return;
    }
  } catch {
    // fall through to fetch
  }
  fetch('/api/perf/beacon', {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => undefined);
}

export function PerfReporter() {
  useReportWebVitals(reportVital);
  return null;
}
