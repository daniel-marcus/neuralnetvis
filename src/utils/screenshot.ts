import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useSceneStore } from "@/store"

const useIsScreenshot = () =>
  typeof useSearchParams().get("screenshot") === "string"

export function useScreenshotBodyClass() {
  const isScreenshot = useIsScreenshot()
  useEffect(() => {
    if (isScreenshot) document.body.classList.add("screenshot")
    return () => document.body.classList.remove("screenshot")
  }, [isScreenshot])
}

export function useScreenshotSettings(isActive: boolean) {
  const isScreenshot = useIsScreenshot()
  const setLoadWeights = useSceneStore((s) => s.setLoadWeights)
  const setLoadFullDs = useSceneStore((s) => s.setLoadFullDs)
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  useEffect(() => {
    if (!isActive || !isScreenshot) return
    setLoadFullDs(true)
    setLoadWeights(true)
    setVisConfig({ showHiddenLayers: true })
  }, [isActive, isScreenshot, setLoadFullDs, setLoadWeights, setVisConfig])
}
