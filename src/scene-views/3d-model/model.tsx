import { useMemo } from "react"
import { useSceneStore } from "@/store"
import { useLayers, type NeuronLayer } from "@/neuron-layers"
import { useActivations } from "@/model/activations"
import { useAnimatedPosition, useDynamicXShift } from "./utils"
import { Layer } from "./layer"
import { HoverComponents } from "./interactions"

export const Model = () => {
  const isActive = useSceneStore((s) => s.isActive)
  const visibleLayers = useLayers()
  const position = useModelOffset(visibleLayers)
  const ref = useAnimatedPosition(position, 0.1)
  useDynamicXShift(visibleLayers.length)
  useActivations()
  return (
    <>
      <group ref={ref}>
        {visibleLayers.map((l, _, arr) => (
          <Layer key={l.lid} {...l} visibleLayers={arr} />
        ))}
      </group>
      {isActive && <HoverComponents />}
    </>
  )
}

function useModelOffset(visibleLayers: NeuronLayer[]) {
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
