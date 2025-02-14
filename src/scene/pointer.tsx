import { useAnimatedPosition, getWorldPos } from "@/scene/utils"
import { OUTPUT_ORIENT, getNeuronPos } from "@/neuron-layers/layout"
import { useNeuronSpacing } from "./neuron-group"
import type { LayerStateful, Neuron } from "@/neuron-layers/types"
import { useStore } from "@/store"

export function YPointer({ outputLayer }: { outputLayer: LayerStateful }) {
  const trainingY = useStore((s) => s.sample?.y)
  const neuron = outputLayer.neurons.find((n) => n.index === trainingY)
  const { layerPos, meshParams } = outputLayer
  const spacing = useNeuronSpacing(meshParams)
  if (!neuron) return null
  const [, height, width = 1] = outputLayer.tfLayer.outputShape as number[]
  const position = getNeuronPos(neuron.index, layerPos, height, width, spacing)
  const color = Number(neuron.activation) > 0.5 ? "rgb(0, 200, 80)" : "white"
  return <Pointer position={position} color={color} />
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
  color: string
}

export const Pointer = ({ position, color }: PointerProps) => {
  const [x, y, z] = position
  const pointerPosition = getPointerPos(x, y, z)
  const [ref] = useAnimatedPosition(pointerPosition, 0.6)
  return (
    <customText
      ref={ref}
      position={getPointerPos(x, y, z)}
      text={"☜"} // ·
      fontSize={1}
      color={color}
      anchorX="center"
      anchorY="middle"
      rotation={[0, -Math.PI / 2, 0]}
    />
  )
}

function getPointerPos(x: number, y: number, z: number) {
  if (OUTPUT_ORIENT === "vertical")
    return [x, y - 0.1, z + 2.2] // [x, y, z + 2.5]
  else return [x, y + 5, z]
}
