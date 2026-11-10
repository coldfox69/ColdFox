'use client';

import { useEffect } from 'react';

type Vital = {
  name: string;
  value: number;
  rating?: string;
  id?: string;
  navigationType?: string;
};

/**
 * Real-user speed reporting.
 *
 * Uses the browser's own PerformanceObserver for the Core Web Vitals that are
 * available without a third-party script: LCP, CLS and TTFB. The report is
 * sent with `sendBeacon` so it never blocks navigation, and the payload is
 * tiny. Third-party scripts are deliberately not loaded.
 */
function observe(type: string, cb: (entry: PerformanceEntry) => void) {
  try {
    const list = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] }).supportedEntryTypes ?? [];
    if (!list.includes(type)) return;
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) cb(last);
    });
    observer.observe({ type, buffered: true } as PerformanceObserverInit);
    return observer;
  } catch {
    return undefined;
  }
}

export function PerfReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sent = new Set<string>();

    const send = (vital: Vital) => {
      const key = `${vital.name}`;
      if (sent.has(key)) return;
      sent.add(key);
      const body = JSON.stringify({
        path: window.location.pathname,
        metric: vital.name,
        value: Math.round(vital.value * 100) / 100,
        rating: vital.rating ?? null,
        navigationType: vital.navigationType ?? null,
      });
      try {
        navigator.sendBeacon('/api/perf/beacon', new Blob([body], { type: 'application/json' }));
      } catch {
        fetch('/api/perf/beacon', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => undefined);
      }
    };

    const observers: (PerformanceObserver | undefined)[] = [];

    // Largest Contentful Paint
    observers.push(
      observe('largest-contentful-paint', (entry) => {
        const value = entry.startTime;
        send({ name: 'LCP', value, rating: value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor' });
      }),
    );

    // Cumulative Layout Shift
    let clsValue = 0;
    try {
      const list = (PerformanceObserver as unknown as { supportedEntryTypes?: string[] }).supportedEntryTypes ?? [];
      if (list.includes('layout-shift')) {
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
            if (!shift.hadRecentInput && typeof shift.value === 'number') clsValue += shift.value;
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
        observers.push(observer);
      }
    } catch {
      // ignore
    }

    // Time to First Byte
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (nav && nav.responseStart > 0) {
        send({ name: 'TTFB', value: nav.responseStart, rating: nav.responseStart <= 800 ? 'good' : nav.responseStart <= 1800 ? 'needs-improvement' : 'poor' });
      }
    } catch {
      // ignore
    }

    // First Input Delay (approximated from the first interaction)
    const onFirstInput = () => {
      try {
        const entries = performance.getEntriesByType('event') as (PerformanceEventTiming & { processingStart?: number; startTime?: number })[];
        const first = entries[0];
        if (first && typeof first.processingStart === 'number') {
          const delay = first.processingStart - first.startTime;
          send({ name: 'FID', value: delay, rating: delay <= 100 ? 'good' : delay <= 300 ? 'needs-improvement' : 'poor' });
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('pointerdown', onFirstInput, { once: true, passive: true });
    window.addEventListener('keydown', onFirstInput, { once: true, passive: true });

    const flush = () => {
      if (clsValue > 0) {
        send({ name: 'CLS', value: clsValue, rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor' });
      }
    };
    window.addEventListener('pagehide', flush);

    return () => {
      window.removeEventListener('pagehide', flush);
      observers.forEach((o) => o?.disconnect());
    };
  }, []);

  return null;
}
