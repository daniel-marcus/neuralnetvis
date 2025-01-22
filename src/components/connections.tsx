import { Segment, Segments } from "@react-three/drei"
import { LayerProps, Point } from "./sequential"
// import { normalizeWithSign } from "@/lib/normalization"
import { useMemo } from "react"

export const LINE_ACTIVATION_THRESHOLD = 0.7

type NeuronConnectionsProps = {
  layer: LayerProps
  prevLayer: LayerProps
}

// const MAX_WIDTH = 1

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const linePoints = useMemo(() => {
    const result = layer.positions?.reduce((acc, position, neuronIndex) => {
      const prevPositions = prevLayer.positions ?? []
      const newConnections = prevPositions.map((prevPosition, prevIndex) => ({
        start: prevPosition,
        end: position,
        neuronIndex,
        prevIndex,
      }))
      return [...acc, ...newConnections]
    }, [] as { start: Point; end: Point; neuronIndex: number; prevIndex: number }[])
    return result
  }, [layer.positions, prevLayer.positions])
  // TODO: show only most active connections
  // TODO: dynamic line width based on average activation
  return (
    <Segments lineWidth={0.5}>
      {linePoints?.map(({ start, end, neuronIndex, prevIndex }, i) => {
        const neuron = layer.neurons[neuronIndex]
        if (!neuron) return null
        const { normalizedActivation, weightedInputs } = neuron
        if ((normalizedActivation ?? 0) < LINE_ACTIVATION_THRESHOLD) return null
        const weightedInput = weightedInputs?.[prevIndex]
        if ((weightedInput ?? 0) < 0.1) return null
        return <Segment key={i} start={start} end={end} />
      })}
    </Segments>
  )
}
