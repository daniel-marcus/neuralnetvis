import { useEffect, useState, useRef } from "react"

type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

export function useIsScreen(bp: Breakpoint) {
  const [isScreen, setIsScreen] = useState(false)
  const windowWidth = useWindowWidth()
  useEffect(() => {
    if (typeof window !== "undefined") {
      const styles = getComputedStyle(document.documentElement)
      const bpRem = styles.getPropertyValue(`--breakpoint-${bp}`).trim()
      const bpPx = parseInt(bpRem) * parseFloat(styles.fontSize)
      setIsScreen(windowWidth >= bpPx)
    }
  }, [bp, windowWidth])
  return isScreen
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
