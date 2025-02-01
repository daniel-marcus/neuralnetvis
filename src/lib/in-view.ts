import { useRef, useEffect, useState } from "react"

interface StateProps {
  inView: boolean
  y: number | undefined
  direction: "up" | "down" | "none"
}

export function useInView(
  options: IntersectionObserverInit = {},
  existingRef?: React.RefObject<HTMLDivElement>
) {
  const { root, rootMargin, threshold } = options
  const newRef: React.RefObject<HTMLDivElement | null> = useRef(null)
  const ref = existingRef ?? newRef
  const [state, setState] = useState<StateProps>({
    inView: false,
    y: undefined,
    direction: "none",
  })
  useEffect(() => {
    const options = { root, rootMargin, threshold }
    if (!ref.current) return
    const o = new IntersectionObserver(([entry]) => {
      const { y } = entry.boundingClientRect
      setState((oldState) => ({
        inView: entry.isIntersecting,
        y,
        direction:
          typeof oldState.y === "undefined"
            ? "none"
            : y > oldState.y
            ? "up"
            : "down",
      }))
    }, options)
    o.observe(ref.current)
  }, [ref, root, rootMargin, threshold])
  return [ref, state.inView, state.direction] as const
}
