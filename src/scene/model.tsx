import { useLayers } from "@/neuron-layers"
import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"
import { Highlighted } from "./highlighted"
import { DatasetDef } from "@/data"

interface ModelProps {
  isActive?: boolean
  dsDef?: DatasetDef
}

export const Model = ({ isActive, dsDef }: ModelProps) => {
  const layers = useLayers(!isActive, dsDef)
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
