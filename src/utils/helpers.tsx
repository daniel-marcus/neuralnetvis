import { useRef, useEffect } from "react"

export function useLast<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}

export const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(val, max))

// returns a funtion that is throttled by requestAnimationFrame
export function rafThrottle<T extends (...args: never[]) => void>(
  fn: T
): (...args: Parameters<T>) => void {
  let ticking = false
  let lastArgs: Parameters<T>

  return function (...args: Parameters<T>) {
    lastArgs = args
    if (!ticking) {
      ticking = true
      requestAnimationFrame(() => {
        fn(...lastArgs)
        ticking = false
      })
    }
  }
}
