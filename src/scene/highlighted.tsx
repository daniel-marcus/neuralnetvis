import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { getWorldPos } from "./utils"

export function Highlighted() {
  const hovered = useHovered()
  const _selected = useSelected()
  const selected = hovered || _selected
  if (!selected) return null
  const pos = getWorldPos(selected)
  return (
    <mesh position={pos} scale={1.5}>
      <primitive
        object={selected.layer.meshParams.geometry}
        attach={"geometry"}
      />
      <meshBasicMaterial
        color="rgb(140, 146, 164)"
        transparent
        opacity={0.3}
        wireframe
      />
    </mesh>
  )
}
