import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { MeshDiscardMaterial, Outlines } from "@react-three/drei"
import { getWorldPos } from "./utils"
import type { Neuron } from "@/neuron-layers"
import type { Mesh } from "three"

interface HighlightedProps {
  neuron?: Neuron
  thick?: boolean
}

const COLOR = "white" // "rgb(150, 156, 171)"

export function Highlighted({ neuron, thick }: HighlightedProps) {
  const ref = useRef<Mesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(invalidate, [neuron, invalidate])
  useFrame(() => {
    if (!neuron || !ref.current) return
    const pos = getWorldPos(neuron)
    if (!pos) return
    ref.current!.position.copy(pos)
  })
  if (!neuron) return null
  const { geometry } = neuron.layer.meshParams
  return (
    <mesh ref={ref} scale={thick ? 1.15 : 1.1}>
      <primitive object={geometry} attach={"geometry"} />
      <MeshDiscardMaterial />
      <Outlines color={COLOR} transparent opacity={0.2} />
    </mesh>
  )
}
