import { useSceneStore } from "@/store"
import {
  useAnimatedPosition,
  getWorldPos,
  type Pos,
} from "@/scene-views/3d-model/utils"
import { LABEL_COLOR } from "./label"
import type { NeuronLayer, Neuron } from "@/neuron-layers/types"
import { PosObj } from "./layer-instanced"

interface YPointerProps {
  outputLayer: NeuronLayer
  positions: PosObj[]
}

export function YPointer({ outputLayer, positions }: YPointerProps) {
  const { meshParams } = outputLayer
  const trainingY = useSceneStore((s) => s.sample?.y)
  const showPointer = useSceneStore((s) => s.vis.showPointer)
  if (!showPointer || typeof trainingY !== "number") return null
  const position = positions[trainingY]
  if (!position) return null
  return (
    <Pointer
      position={position.pos}
      color={LABEL_COLOR}
      size={meshParams.labelSize}
    />
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
  const ref = useAnimatedPosition(pointerPosition, 0.6)
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  if (!lightsOn) return null
  return (
    <customText
      ref={ref}
      text={"☜"}
      fontSize={size}
      color={color}
      anchorX="left"
      anchorY="middle"
      rotation={[0, -Math.PI / 2, 0]}
    />
  )
}
