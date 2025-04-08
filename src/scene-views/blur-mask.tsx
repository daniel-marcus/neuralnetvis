import { useEffect } from "react"
import { useCurrScene, useGlobalStore } from "@/store"

export function useHasBlur() {
  const status = useGlobalStore((s) => s.status.getCurrent())
  const isEvaluationView = useCurrScene((s) => s.view === "evaluation")
  const hasSample = useCurrScene((s) => s.sampleIdx !== undefined)
  return !!status?.fullscreen || (isEvaluationView && !hasSample)
}

export function BlurMask() {
  const hasBlur = useHasBlur()
  useEffect(() => {
    if (!hasBlur) return
    const themeColorTag = document.querySelector("meta[name=theme-color]")
    const defaultThemeColor = themeColorTag?.getAttribute("content")
    if (!themeColorTag || !defaultThemeColor) return
    themeColorTag.setAttribute("content", "#000000")
    return () => themeColorTag?.setAttribute("content", defaultThemeColor)
  }, [hasBlur])
  return (
    <div
      className={`fixed top-0 left-0 w-full h-full ${
        hasBlur
          ? "backdrop-blur-sm backdrop-brightness-75 backdrop-grayscale-100"
          : "pointer-events-none"
      } transition-all duration-300`}
    />
  )
}
