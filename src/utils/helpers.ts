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
