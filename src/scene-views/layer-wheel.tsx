import { useCallback, useEffect, useMemo } from "react"
import { useSceneStore } from "@/store"
import { WheelMenu } from "@/components/ui-elements/wheel-menu"
import type { Layer } from "@tensorflow/tfjs-layers/dist/exports_layers"

export const LayerWheel = () => {
  const model = useSceneStore((s) => s.model)
  const layers = useMemo(() => model?.layers ?? [], [model])
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)
  const items = useMemo(() => layers.map(layer2WheelItem), [layers])
  const [enter2d, enter3d] = useAutoFlatView(typeof focussedIdx === "number")
  return (
    <div
      className={`fixed top-0 right-0 h-screen flex flex-col items-start justify-center pointer-events-none overflow-visible`}
    >
      <WheelMenu
        items={items}
        currIdx={focussedIdx}
        setCurrIdx={setFocussedIdx}
        onScroll={enter3d}
        onScrollEnd={enter2d}
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
  return ["Flatten", "Dropout"].includes(layer.getClassName())
}
