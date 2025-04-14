import { useEffect } from "react"
import { useCurrScene, useGlobalStore } from "@/store"

type MaskMode = "blur" | "dark" | undefined

export function useMaskMode(): MaskMode {
  const status = useGlobalStore((s) => s.status.getCurrent())
  const isEvaluationView = useCurrScene((s) => s.view === "evaluation")
  const hasSample = useCurrScene((s) => s.sampleIdx !== undefined)
  const hasFullscreenConfusionMatrix = useCurrScene(
    (s) => (s.ds?.outputLabels?.length ?? 0) > 10
  )
  return !!status?.fullscreen
    ? "blur"
    : isEvaluationView && !hasSample
    ? hasFullscreenConfusionMatrix
      ? "dark"
      : "blur"
    : undefined
}

export function BlurMask() {
  const maskMode = useMaskMode()
  useEffect(() => {
    if (!maskMode) return
    const themeColorTag = document.querySelector("meta[name=theme-color]")
    const defaultThemeColor = themeColorTag?.getAttribute("content")
    if (!themeColorTag || !defaultThemeColor) return
    themeColorTag.setAttribute("content", "#000000")
    return () => themeColorTag?.setAttribute("content", defaultThemeColor)
  }, [maskMode])
  return (
    <div
      className={`fixed top-0 left-0 w-full h-full ${
        maskMode === "blur"
          ? "backdrop-blur-sm backdrop-brightness-75 backdrop-grayscale-100"
          : maskMode === "dark"
          ? "bg-background grayscale-100"
          : ""
      } transition-all duration-300 pointer-events-none`}
    />
  )
}
