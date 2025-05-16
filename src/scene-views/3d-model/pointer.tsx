import { useSceneStore } from "@/store"
import { useAnimatedPosition, getWorldPos } from "@/scene-views/3d-model/utils"
import { getNeuronPos } from "@/neuron-layers/layout"
import { useNeuronSpacing } from "./layer-instanced"
import { TextLabel } from "./label"
import type { NeuronLayer, Neuron } from "@/neuron-layers/types"

export function YPointer({ outputLayer }: { outputLayer: NeuronLayer }) {
  const { layerPos, meshParams } = outputLayer
  const trainingY = useSceneStore((s) => s.sample?.y)
  const { spacedSize } = useNeuronSpacing(meshParams)
  const showPointer = useSceneStore((s) => s.vis.showPointer)
  if (!showPointer || typeof trainingY !== "number") return null
  const index = trainingY
  const [, height, width = 1, channels = 1] = outputLayer.tfLayer
    .outputShape as number[]
  const pos = getNeuronPos(index, layerPos, height, width, channels, spacedSize)
  return <Pointer position={pos} size={meshParams.labelSize} />
}

export function NeuronPointer({ pointedNeuron }: { pointedNeuron: Neuron }) {
  // can be used for custom pointing later
  if (!pointedNeuron) return null
  const v = getWorldPos(pointedNeuron)
  if (!v) return null
  const position = [v.x, v.y, v.z] as [number, number, number]
  return <Pointer position={position} color="white" />
}

interface PointerProps {
  position: [number, number, number]
  color?: string
  size?: number
}

export const Pointer = ({ position: [x, y, z], size = 1 }: PointerProps) => {
  const position = [x, y, z + size * 1.7] as [number, number, number]
  const ref = useAnimatedPosition(position, 0.6)
  return (
    <group ref={ref}>
      <TextLabel text="☜" side="right" />
    </group>
  )
}
