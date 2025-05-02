import { useMemo } from "react"
import { useSceneStore } from "@/store"
import { useLayers, type LayerStateless } from "@/neuron-layers"
import { useAnimatedPosition, useDynamicXShift } from "./utils"
import { Layer } from "./layer"
import { HoverComponents } from "./highlighted"

export const Model = () => {
  const isActive = useSceneStore((s) => s.isActive)
  const layers = useLayers() // !isActive
  const position = useModelOffset(layers)
  const [ref] = useAnimatedPosition(position, 0.1)
  useDynamicXShift()
  return (
    <>
      <group ref={ref}>
        {layers.map((l, _, arr) => (
          <Layer
            key={`${l.tfLayer.name}_${l.neurons.length}`}
            {...l}
            allLayers={arr}
          />
        ))}
      </group>
      {isActive && <HoverComponents />}
    </>
  )
}

function useModelOffset(layers: LayerStateless[]) {
  const visibleLayers = layers.filter((l) => l.neurons.length)
  const focusIdx = useSceneStore((s) => s.focussedLayerIdx)
  const hasFocussed = typeof focusIdx === "number"
  const focusVisibleIdx = visibleLayers.findIndex((l) => l.index === focusIdx)
  const center = (visibleLayers.length - 1) * 0.5
  const offset = !hasFocussed ? 0 : center - focusVisibleIdx

  const { xShift, yShift, zShift } = useSceneStore((s) => s.vis)
  const position = useMemo(
    () => [offset * xShift, offset * yShift, offset * zShift],
    [offset, xShift, yShift, zShift]
  )
  return position
}
