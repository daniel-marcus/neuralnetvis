import { Fragment, useEffect, useRef, useState } from "react"
import type { FragmentInstance } from "react"

export function usePrevious<T>(value: T) {
  const [previous, setPrevious] = useState<T>(value)
  const [current, setCurrent] = useState<T>(value)

  if (value !== current) {
    setPrevious(current)
    setCurrent(value)
  }

  return previous
}

export function useDidMount<T = unknown>(providedRef?: React.RefObject<T>) {
  const newRef = useRef<T>(null)
  const ref = providedRef || newRef
  const [didMount, setDidMount] = useState(false)
  useEffect(() => {
    setDidMount(!!ref.current)
  }, [ref])
  return [ref, didMount] as const
}

export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [ref, didMount] = useDidMount<FragmentInstance>()
  return <Fragment ref={ref}>{didMount ? children : null}</Fragment>
}

export const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(val, max))

// returns a funtion that is throttled by requestAnimationFrame
export function rafThrottle<T extends (...args: never[]) => void>(
  fn: T,
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
