import { getWorldPos } from "./utils"
import { MeshDiscardMaterial, Outlines } from "@react-three/drei"
import { Neuron } from "@/neuron-layers"
import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import { Mesh } from "three"

interface HighlightedProps {
  neuron?: Neuron
  thick?: boolean
}

const COLOR = "rgb(140, 146, 164)"

export function Highlighted({ neuron, thick }: HighlightedProps) {
  const ref = useRef<Mesh>(null)
  useFrame(() => {
    if (!neuron || !ref.current) return
    const pos = getWorldPos(neuron)
    if (!pos) return
    ref.current!.position.copy(pos)
  })
  if (!neuron) return null
  const { geometry } = neuron.layer.meshParams
  return (
    <mesh ref={ref} scale={thick ? 1.1 : 1.05}>
      <primitive object={geometry} attach={"geometry"} />
      <MeshDiscardMaterial />
      <Outlines color={COLOR} />
    </mesh>
  )
}
