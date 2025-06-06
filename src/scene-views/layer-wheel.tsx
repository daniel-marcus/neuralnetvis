"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useHasFocussed, useSceneStore } from "@/store"
import { WheelMenu } from "@/components/ui-elements/wheel-menu"
import { isVisible } from "@/neuron-layers/layers"
import { useHasSample } from "./evaluation/evaluation"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

export const LayerWheel = () => {
  const model = useSceneStore((s) => s.model)
  const modelLayers = useMemo(() => model?.layers ?? [], [model])
  const visibleLayers = useSceneStore((s) => s.allLayers)
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)
  const isGraphView = useSceneStore((s) => s.view === "graph")
  const items = useMemo(() => {
    const visibleIdxs = visibleLayers.map((l) => l.index)
    return modelLayers.map((l, i) =>
      layer2WheelItem(l, !isGraphView, !visibleIdxs.includes(i))
    )
  }, [modelLayers, isGraphView, visibleLayers])
  const view = useSceneStore((s) => s.view)
  const hasSample = useHasSample()
  const { onScrollStart, onScrollEnd } = useAutoFlatView(view !== "graph")
  const [hasMounted, setHasMounted] = useState(false) // to avoid SSR issues with portals
  useEffect(() => setHasMounted(true), [])
  if (!hasMounted) return null
  return createPortal(
    <WheelMenu
      items={items}
      currIdx={focussedIdx}
      setCurrIdx={setFocussedIdx}
      onScrollStart={onScrollStart}
      onScrollEnd={onScrollEnd}
      autoHide={true}
      fullyHidden={view === "map" || (view === "evaluation" && !hasSample)}
    />,
    document.body
  )
}

export function useAutoFlatView(isActive = true) {
  const setFlatView = useSceneStore((s) => s.vis.setFlatView)
  const hasFocussed = useHasFocussed()
  const isScrolling = useSceneStore((s) => s.isScrolling)
  const setScrolling = useSceneStore((s) => s.setIsScrolling)
  const onScrollStart = useCallback(() => setScrolling(true), [setScrolling])
  const onScrollEnd = useCallback(() => setScrolling(false), [setScrolling])

  useEffect(() => {
    if (!isActive) return
    setFlatView(hasFocussed && !isScrolling ? true : false)
  }, [isActive, isScrolling, hasFocussed, setFlatView])

  return isActive ? { onScrollStart, onScrollEnd } : {}
}

const layer2WheelItem = (
  layer: Layer,
  filterInvisible?: boolean,
  notInVisibleLayers?: boolean
) => ({
  label: layer.getClassName(),
  disabled: filterInvisible && (!isVisible(layer) || notInVisibleLayers),
})
