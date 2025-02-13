import { useLayers } from "@/neuron-layers/layers"
import { Layer } from "./layer"
import { HoverConnections } from "./connections"

export const Model = () => {
  const layers = useLayers()
  return (
    <group>
      {layers.map((l, i) => (
        <Layer key={i} {...l} allLayers={layers} />
      ))}
      <HoverConnections />
    </group>
  )
}
