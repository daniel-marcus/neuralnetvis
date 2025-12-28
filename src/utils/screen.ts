import { useGlobalStore } from "@/store"
import { useEffect, useState, useRef } from "react"

const breakpoints = {
  xs: 360,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
}

type Breakpoint = keyof typeof breakpoints

export function useIsScreen(bp: Breakpoint) {
  const [isMatch, setIsMatch] = useState(false)
  const windowSize = useGlobalStore((s) => s.windowSize)
  useEffect(() => {
    setIsMatch(isScreen(bp))
  }, [bp, windowSize])
  return isMatch
}

export function isScreen(bp: Breakpoint) {
  if (typeof window === "undefined") return false
  const bpPx = breakpoints[bp]
  return window.innerWidth >= bpPx
}

export function useOrientation() {
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape",
  )
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.matchMedia("(orientation: landscape)").matches
          ? "landscape"
          : "portrait",
      )
    }
    handleOrientationChange()
    window.addEventListener("orientationchange", handleOrientationChange)
    window.addEventListener("resize", handleOrientationChange)
    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange)
      window.removeEventListener("resize", handleOrientationChange)
    }
  }, [])
  return orientation
}

export function useResizeListener() {
  const setWindowSize = useGlobalStore((s) => s.setWindowSize)
  useEffect(() => {
    const onResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener("resize", onResize)
    onResize()
    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [])
}

interface InViewStateProps {
  inView: boolean
  y: number | undefined
  direction: "up" | "down" | "none"
}

export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = {},
  existingRef?: React.RefObject<T | null>,
) {
  const { root, rootMargin, threshold } = options
  const newRef: React.RefObject<T | null> = useRef(null)
  const ref = existingRef ?? newRef
  const [state, setState] = useState<InViewStateProps>({
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

export const isTouch = () => "ontouchstart" in window
