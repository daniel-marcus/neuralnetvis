import { useEffect, useState } from "react"

export function usePrevious<T>(value: T) {
  const [previous, setPrevious] = useState<T>(value)
  const [current, setCurrent] = useState<T>(value)

  if (value !== current) {
    setPrevious(current)
    setCurrent(value)
  }

  return previous
}

export function useDidMount(ref: React.RefObject<unknown>) {
  const [didMount, setDidMount] = useState(false)
  useEffect(() => {
    setDidMount(!!ref.current)
  }, [ref])
  return didMount
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
