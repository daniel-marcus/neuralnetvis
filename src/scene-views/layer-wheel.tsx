import { useCallback, useEffect, useMemo, useState } from "react"
import { useHasFocussedLayer, useSceneStore } from "@/store"
import { WheelMenu } from "@/components/ui-elements/wheel-menu"
import { isVisible } from "@/neuron-layers/layers"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

export const LayerWheel = () => {
  const model = useSceneStore((s) => s.model)
  const layers = useMemo(() => model?.layers ?? [], [model])
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)
  const isGraphView = useSceneStore((s) => s.view === "graph")
  const items = useMemo(
    () => layers.map((l) => layer2WheelItem(l, !isGraphView)),
    [layers, isGraphView]
  )
  const view = useSceneStore((s) => s.view)
  const { onScrollStart, onScrollEnd } = useAutoFlatView(view !== "graph")
  return (
    <WheelMenu
      items={items}
      currIdx={focussedIdx}
      setCurrIdx={setFocussedIdx}
      onScrollStart={onScrollStart}
      onScrollEnd={onScrollEnd}
      autoHide={true}
    />
  )
}

export function useAutoFlatView(isActive = true) {
  const setFlatView = useSceneStore((s) => s.vis.setFlatView)
  const hasFocussed = useHasFocussedLayer()
  const [isScrolling, setIsScrolling] = useState(false)
  const onScrollStart = useCallback(() => setIsScrolling(true), [])
  const onScrollEnd = useCallback(() => setIsScrolling(false), [])

  useEffect(() => {
    if (!isActive) return
    setFlatView(hasFocussed && !isScrolling ? true : false)
  }, [isActive, isScrolling, hasFocussed, setFlatView])

  return isActive ? { onScrollStart, onScrollEnd } : {}
}

const layer2WheelItem = (layer: Layer, filterInvisible?: boolean) => ({
  label: layer.getClassName(),
  disabled: filterInvisible && !isVisible(layer),
})
