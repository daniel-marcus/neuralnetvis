import { useLayers } from "@/neuron-layers"
import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"
import { Highlighted } from "./highlighted"

export const Model = ({ isActive }: { isActive?: boolean }) => {
  const layers = useLayers()
  const selected = useSelected()
  const hovered = useHovered()
  return (
    <>
      <group>
        {layers.slice(0, isActive ? layers.length : 1).map((l, _, arr) => (
          <Layer key={`${l.tfLayer.name}`} {...l} allLayers={arr} />
        ))}
        <HoverConnections />
        <Highlighted neuron={selected} thick />
        <Highlighted neuron={hovered} />
      </group>
    </>
  )
}
