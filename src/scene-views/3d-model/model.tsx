import { useLayers } from "@/neuron-layers"
import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"
import { Highlighted } from "./highlighted"
import { useSceneStore } from "@/store"

export const Model = () => {
  const isActive = useSceneStore((s) => s.isActive)
  const layers = useLayers(!isActive)
  return (
    <group>
      {layers.map((l, _, arr) => (
        <Layer key={`${l.tfLayer.name}`} {...l} allLayers={arr} />
      ))}
      {isActive && <HoverComponents />}
    </group>
  )
}

function HoverComponents() {
  const selected = useSelected()
  const hovered = useHovered()
  return (
    <>
      <HoverConnections />
      <Highlighted neuron={selected} thick />
      <Highlighted neuron={hovered} />
    </>
  )
}
