import { useEffect, useState } from "react"

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
