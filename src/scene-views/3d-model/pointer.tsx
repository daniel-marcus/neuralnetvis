import { useSceneStore } from "@/store"
import {
  useAnimatedPosition,
  getWorldPos,
  type Pos,
} from "@/scene-views/3d-model/utils"
import { getNeuronPos } from "@/neuron-layers/layout"
import { useNeuronSpacing } from "./layer-instanced"
import { LABEL_COLOR } from "./label"
import type { LayerStateless, Neuron } from "@/neuron-layers/types"

export function YPointer({ outputLayer }: { outputLayer: LayerStateless }) {
  const trainingY = useSceneStore((s) => s.sample?.y)
  const neuron = outputLayer.neurons.find((n) => n.index === trainingY)
  const { layerPos, meshParams } = outputLayer
  const spacing = useNeuronSpacing(meshParams)
  const showPointer = useSceneStore((s) => s.vis.showPointer)
  if (!showPointer || !neuron) return null
  const { index } = neuron
  const [, height, width = 1, channels = 1] = outputLayer.tfLayer
    .outputShape as number[]
  const pos = getNeuronPos(index, layerPos, height, width, channels, spacing)
  return (
    <Pointer position={pos} color={LABEL_COLOR} size={meshParams.labelSize} />
  )
}

export function NeuronPointer({ pointedNeuron }: { pointedNeuron: Neuron }) {
  // can be used for custom pointing later
  if (!pointedNeuron) return null
  const v = getWorldPos(pointedNeuron)
  if (!v) return null
  const position = [v.x, v.y, v.z] as Pos
  return <Pointer position={position} color="white" />
}

interface PointerProps {
  position: Pos
  color: string
  size?: number
}

export const Pointer = ({ position, color, size = 1 }: PointerProps) => {
  const [x, y, z] = position
  const pointerPosition = [x, y, z + size * 1.7] as Pos
  const [ref] = useAnimatedPosition(pointerPosition, 0.6)
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  if (!lightsOn) return null
  return (
    <customText
      ref={ref}
      position={pointerPosition}
      text={"☜"}
      fontSize={size}
      color={color}
      anchorX="left"
      anchorY="middle"
      rotation={[0, -Math.PI / 2, 0]}
    />
  )
}
