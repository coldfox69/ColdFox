'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounce a fast-changing value. Used by every search and autocomplete input
 * so typing does not fire a request per keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/**
 * Debounce a callback. The latest arguments win and the call is dropped if the
 * component unmounts before the timer fires.
 */
export function useDebouncedCallback<T extends (...args: never[]) => void>(callback: T, delayMs = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
  }, [delayMs]);
}
