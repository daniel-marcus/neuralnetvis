import { getWorldPos } from "./utils"
import { MeshDiscardMaterial, Outlines } from "@react-three/drei"
import { Neuron } from "@/neuron-layers"

interface HighlightedProps {
  neuron?: Neuron
  thick?: boolean
}

const COLOR = "rgb(140, 146, 164)"

export function Highlighted({ neuron, thick }: HighlightedProps) {
  if (!neuron) return null
  const pos = getWorldPos(neuron)
  const { geometry } = neuron.layer.meshParams
  return (
    <mesh position={pos} scale={thick ? 1.1 : 1.05}>
      <primitive object={geometry} attach={"geometry"} />
      <MeshDiscardMaterial />
      <Outlines color={COLOR} />
    </mesh>
  )
}
