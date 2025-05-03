import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { MeshDiscardMaterial, Outlines } from "@react-three/drei"
import { getWorldPos } from "./utils"
import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { HoverConnections } from "./connections"
import type { Neuron } from "@/neuron-layers"
import type { Mesh } from "three"

export function HoverComponents() {
  const selected = useSelected()
  const hovered = useHovered()
  /* const hasFocussedLayer = useHasFocussedLayer() */
  return (
    <>
      <HoverConnections hovered={hovered} />
      <Highlighted neuron={selected} thick />
      <Highlighted neuron={hovered} />
    </>
  )
}

interface HighlightedProps {
  neuron?: Neuron
  thick?: boolean
}

const COLOR = "rgb(150, 156, 171)"

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
      <Outlines color={COLOR} />
    </mesh>
  )
}
