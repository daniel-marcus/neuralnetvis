import type * as THREE from "three/webgpu"
import { useSceneStore } from "@/store"
import { useAnimatedPosition } from "@/scene-views/3d-model/utils"
import { TextLabel } from "./label"
import { LABEL_COLOR } from "./label"
import type { NeuronLayer } from "@/neuron-layers/types"
import type { PosObj } from "./layer-instanced"

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
  return <Pointer position={position.pos} color={LABEL_COLOR} size={meshParams.labelSize} />
}

interface PointerProps {
  position: [number, number, number]
  color?: string | THREE.Color
  size?: number
}

const Pointer = ({ position: [x, y, z], size = 1, color }: PointerProps) => {
  const position = [x, y, z + size * 1.7] as [number, number, number]
  const ref = useAnimatedPosition(position, 0.6)
  return (
    <group ref={ref}>
      <TextLabel text="◀" side="right" color={color} />
    </group>
  )
}
