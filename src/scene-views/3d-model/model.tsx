import { useMemo } from "react"
import { useSceneStore } from "@/store"
import { useLayers, type NeuronLayer } from "@/neuron-layers"
import { ActivationUpdater } from "@/model/activations"
import { useAnimatedPosition, useDynamicXShift } from "./utils"
import { Layer } from "./layer"
import { HoverComponents } from "./interactions"

export const Model = () => {
  const layers = useLayers()
  return (
    <>
      <ActivationUpdater layers={layers} />
      <ModelShifter layers={layers}>
        {layers.map((l) => (
          <Layer key={l.lid} {...l} allLayers={layers} />
        ))}
      </ModelShifter>
      <HoverComponents />
    </>
  )
}

interface ModelShifterProps {
  children: React.ReactNode
  layers: NeuronLayer[]
}

function ModelShifter({ children, layers }: ModelShifterProps) {
  const position = useModelOffset(layers)
  const ref = useAnimatedPosition(position, 0.1)
  useDynamicXShift(layers.length)
  return <group ref={ref}>{children}</group>
}

function useModelOffset(visibleLayers: NeuronLayer[]) {
  const focusIdx = useSceneStore((s) => s.focussedLayerIdx)
  const hasFocussed = typeof focusIdx === "number"
  const focusVisibleIdx = hasFocussed
    ? visibleLayers.findIndex((l) => l.index === focusIdx)
    : -1
  const center = (visibleLayers.length - 1) * 0.5
  const offset = !hasFocussed ? 0 : center - focusVisibleIdx

  const { xShift, yShift, zShift } = useSceneStore((s) => s.vis)
  const position = useMemo(
    () => [offset * xShift, offset * yShift, offset * zShift],
    [offset, xShift, yShift, zShift]
  )
  return position
}
