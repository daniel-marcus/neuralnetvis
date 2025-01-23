import { LayerProps } from "./sequential"
import { useContext, useMemo, useRef } from "react"
import { OptionsContext } from "./model"
import { NodeId } from "@/lib/node-select"
import { useFrame, useThree } from "@react-three/fiber"
import { Line, Vector3 } from "three"
// import { normalizeWithSign } from "@/lib/normalization"

export const LINE_ACTIVATION_THRESHOLD = 0.6

type NeuronConnectionsProps = {
  layer: LayerProps
  prevLayer: LayerProps
}

const MAX_WIDTH = 1

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const { hideLines } = useContext(OptionsContext)
  if (hideLines) return null
  return (
    <group>
      {layer.neurons.map((neuron, i) => {
        if (!neuron.activation || neuron.activation < LINE_ACTIVATION_THRESHOLD)
          return null
        return neuron.normalizedWeights?.map((weight, j) => {
          if (Math.abs(weight) < 0.7) return null
          const weightedInput = neuron.weightedInputs?.[j]
          const normalizedWeightedInput = neuron.normalizedWeightedInputs?.[j]
          if (
            !weightedInput ||
            !normalizedWeightedInput ||
            Math.abs(normalizedWeightedInput) < 0.3
          )
            return null
          const prevNeuron = prevLayer.neurons[j]
          if (!prevNeuron) return null
          const lineWidth = Math.min(
            Math.abs(weightedInput) * MAX_WIDTH,
            MAX_WIDTH
          )
          return (
            <DynamicLine
              key={`${i}_${j}`}
              from={prevNeuron.nid}
              to={neuron.nid}
              width={lineWidth}
            />
          )
        })
      })}
    </group>
  )
}

interface DynamicLineProps {
  from: NodeId
  to: NodeId
  width?: number
}

const DynamicLine = ({ from, to }: DynamicLineProps) => {
  const lineRef = useRef<Line | null>(null)
  const { scene } = useThree()
  const fromNode = useMemo(() => scene.getObjectByName(from), [scene, from])
  const toNode = useMemo(() => scene.getObjectByName(to), [scene, to])
  useFrame(() => {
    if (lineRef.current && fromNode && toNode) {
      const fromPosition = new Vector3()
      const toPosition = new Vector3()
      fromNode.getWorldPosition(fromPosition)
      toNode.getWorldPosition(toPosition)

      lineRef.current.geometry.setFromPoints([fromPosition, toPosition])
      lineRef.current.geometry.attributes.position.needsUpdate = true
    }
  })
  // TODO: use width
  return (
    // @ts-expect-error line is interpreted as SVG line
    <line ref={lineRef}>
      <bufferGeometry />
      <lineBasicMaterial color="white" />
    </line>
  )
}
