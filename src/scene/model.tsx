import { useLayers } from "@/neuron-layers"
import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"
import { Highlighted } from "./highlighted"

export const Model = () => {
  const layers = useLayers()
  const selected = useSelected()
  const hovered = useHovered()
  return (
    <group>
      {layers.map((l) => (
        <Layer key={`${l.tfLayer.name}`} {...l} allLayers={layers} />
      ))}
      <HoverConnections />
      <Highlighted neuron={selected} thick />
      <Highlighted neuron={hovered} />
    </group>
  )
}
