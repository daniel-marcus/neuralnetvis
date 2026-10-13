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

const INTRO_DURATION = 2000 // ms
const NO_INTRO_YET = Symbol()

// auto-hide elements: true for a short time after mount (and after every change of trigger),
// so that the user sees the full element before it is tucked away
export function useIsIntro(trigger?: unknown) {
  const [introDoneFor, setIntroDoneFor] = useState<unknown>(NO_INTRO_YET)
  useEffect(() => {
    const timeout = setTimeout(() => setIntroDoneFor(trigger), INTRO_DURATION)
    return () => clearTimeout(timeout)
  }, [trigger])
  return introDoneFor !== trigger
}

export const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(val, max))
