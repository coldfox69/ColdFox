import * as React from "react"

const MOBILE_BREAKPOINT = 768

const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  const onChange = () => notify()
  mql.addEventListener("change", onChange)
  return () => {
    listeners.delete(callback)
    mql.removeEventListener("change", onChange)
  }
}

/**
 * Reads the viewport through `useSyncExternalStore`, so the server render
 * and the first client render agree and no extra render pass is needed.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
