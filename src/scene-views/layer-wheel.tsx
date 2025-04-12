import { useEffect, useMemo } from "react"
import { useSceneStore } from "@/store"
import { WheelMenu } from "@/components/ui-elements/wheel-menu"
import type { LayerConfigArray } from "@/model"

export const LayerWheel = () => {
  const layers = useModelLayers()
  const [currLayer, setCurrLayer] = useLayersFilter(layers)

  const items = useMemo(
    () =>
      layers.map((l) => ({
        label: l.className,
        disabled: isNotVisible(l),
      })),
    [layers]
  )

  return (
    <div
      className={`fixed top-0 right-0 h-screen flex flex-col items-start justify-center pointer-events-none overflow-visible`}
    >
      <WheelMenu items={items} currIdx={currLayer} setCurrIdx={setCurrLayer} />
    </div>
  )
}

function useLayersFilter(layers: LayerConfigArray) {
  const setVisConfig = useSceneStore((s) => s.vis.setConfig)
  const focussedLayerIdx = useSceneStore((s) => s.focussedLayerIdx)
  const setFocussedLayerIdx = useSceneStore((s) => s.setFocussedLayerIdx)

  useEffect(() => {
    const invisibleLayers =
      typeof focussedLayerIdx === "number"
        ? (layers
            .filter((_, i) => i !== focussedLayerIdx)
            .map((l) => l.config.name)
            .filter(Boolean) as string[])
        : []
    setVisConfig({ invisibleLayers })
  }, [focussedLayerIdx, layers, setVisConfig])

  return [focussedLayerIdx, setFocussedLayerIdx] as const
}

function useModelLayers() {
  const model = useSceneStore((s) => s.model)
  const layers = useMemo(
    () => (model?.getConfig().layers ?? []) as unknown as LayerConfigArray,
    [model]
  )
  return layers
}

function isNotVisible(layer: LayerConfigArray[number]) {
  return ["Flatten", "Dropout"].includes(layer.className)
}
