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
  const windowWidth = useWindowWidth()
  useEffect(() => {
    setIsMatch(isScreen(bp))
  }, [bp, windowWidth])
  return isMatch
}

export function isScreen(bp: Breakpoint) {
  if (typeof window === "undefined") return false
  const bpPx = breakpoints[bp]
  return window.innerWidth >= bpPx
}

export function useOrientation() {
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape"
  )
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(
        window.matchMedia("(orientation: landscape)").matches
          ? "landscape"
          : "portrait"
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

export function useWindowWidth() {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener("resize", onResize)
    onResize()
    return () => {
      window.removeEventListener("resize", onResize)
    }
  }, [])
  return width
}

interface InViewStateProps {
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

export function useIsTouchDevice() {
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  useEffect(() => {
    function check() {
      setIsTouchDevice("ontouchstart" in window)
    }
    check()
  }, [])
  return isTouchDevice
}
