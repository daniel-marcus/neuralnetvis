import { useCallback, useEffect, useMemo, useRef } from "react"
import { useHasFocussedLayer, useSceneStore } from "@/store"
import { WheelMenu } from "@/components/ui-elements/wheel-menu"
import { isVisible } from "@/neuron-layers/layers-stateless"
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
    <div
      className={`fixed top-0 right-0 h-screen flex flex-col items-start justify-center pointer-events-none overflow-visible`}
    >
      <WheelMenu
        items={items}
        currIdx={focussedIdx}
        setCurrIdx={setFocussedIdx}
        onScrollStart={onScrollStart}
        onScrollEnd={onScrollEnd}
        autoHide={true}
      />
    </div>
  )
}

export function useAutoFlatView(isActive = true) {
  const setFlatView = useSceneStore((s) => s.vis.setFlatView)
  const isScrolling = useRef(false)
  const onScrollStart = useCallback(() => {
    isScrolling.current = true
    setFlatView(false)
  }, [setFlatView])
  const onScrollEnd = useCallback(() => {
    isScrolling.current = false
    setFlatView(true)
  }, [setFlatView])

  const hasFocussed = useHasFocussedLayer()
  useEffect(() => {
    if (!isActive || isScrolling.current) return
    setFlatView(hasFocussed ? true : false)
  }, [isActive, hasFocussed, setFlatView])

  return isActive ? { onScrollStart, onScrollEnd } : {}
}

const layer2WheelItem = (layer: Layer, filterInvisible?: boolean) => ({
  label: layer.getClassName(),
  disabled: filterInvisible && !isVisible(layer),
})
