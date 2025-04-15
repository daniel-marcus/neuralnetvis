import { useCallback, useEffect, useMemo } from "react"
import { useSceneStore } from "@/store"
import { WheelMenu } from "@/components/ui-elements/wheel-menu"
import { getLayerDef } from "@/model/layers"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

export const LayerWheel = () => {
  const model = useSceneStore((s) => s.model)
  const layers = useMemo(() => model?.layers ?? [], [model])
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)
  const items = useMemo(() => layers.map(layer2WheelItem), [layers])
  const view = useSceneStore((s) => s.view)
  const [enter2d, enter3d] = useAutoFlatView(
    typeof focussedIdx === "number" && view !== "graph"
  )
  return (
    <div
      className={`fixed top-0 right-0 h-screen flex flex-col items-start justify-center pointer-events-none overflow-visible`}
    >
      <WheelMenu
        items={items}
        currIdx={focussedIdx}
        setCurrIdx={setFocussedIdx}
        onScroll={view !== "graph" ? enter3d : undefined}
        onScrollEnd={view !== "graph" ? enter2d : undefined}
        autoHide={true}
      />
    </div>
  )
}

export function useAutoFlatView(active: boolean) {
  const setVis = useSceneStore((s) => s.vis.setConfig)
  const enter2d = useCallback(() => setVis({ flatView: true }), [setVis])
  const enter3d = useCallback(() => setVis({ flatView: false }), [setVis])

  useEffect(() => {
    if (!active) return
    enter2d()
    return () => enter3d()
  }, [active, enter2d, enter3d])

  return [enter2d, enter3d] as const
}

const layer2WheelItem = (layer: Layer) => ({
  label: layer.getClassName(),
  disabled: isNotVisible(layer),
})

function isNotVisible(layer: Layer) {
  const className = layer.getClassName()
  const layerDef = getLayerDef(className)
  if (layerDef?.isInvisible) return true
  // return ["Flatten", "Dropout"].includes(layer.getClassName())
}
