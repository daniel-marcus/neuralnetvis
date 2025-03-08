import { useLayers } from "@/neuron-layers"
import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"
import { Highlighted } from "./highlighted"

interface ModelProps {
  isActive?: boolean
  dsKey?: string
}

export const Model = ({ isActive, dsKey }: ModelProps) => {
  const layers = useLayers(!isActive, dsKey)
  const selected = useSelected()
  const hovered = useHovered()
  return (
    <>
      <group>
        {layers.map((l, _, arr) => (
          <Layer key={`${l.tfLayer.name}`} {...l} allLayers={arr} />
        ))}
        {isActive && (
          <>
            <HoverConnections />
            <Highlighted neuron={selected} thick />
            <Highlighted neuron={hovered} />
          </>
        )}
      </group>
    </>
  )
}
