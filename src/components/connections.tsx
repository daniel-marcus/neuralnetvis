import { Suspense, useContext, useMemo, useRef } from "react"
import { OptionsContext } from "./model"
import { NodeId } from "@/lib/node-select"
import { useFrame, useThree } from "@react-three/fiber"
import { Line, Vector3 } from "three"
import { LayerDef } from "./layer"
// import { Line2, LineGeometry, LineMaterial } from "three/examples/jsm/Addons.js"
// import { normalizeWithSign } from "@/lib/normalization"

export const LINE_ACTIVATION_THRESHOLD = 0.5

type NeuronConnectionsProps = {
  layer: LayerDef
  prevLayer: LayerDef
}

const MAX_WIDTH = 1

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const { hideLines } = useContext(OptionsContext)
  if (hideLines) return null
  return (
    <Suspense fallback={null}>
      <group>
        {layer.neurons.map((neuron, i) => {
          if (
            !neuron.activation ||
            neuron.activation < LINE_ACTIVATION_THRESHOLD
          )
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
            if (
              !prevNeuron?.activation ||
              prevNeuron.activation < LINE_ACTIVATION_THRESHOLD
            )
              return null
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
    </Suspense>
  )
}

interface DynamicLineProps {
  from: NodeId
  to: NodeId
  width?: number
}

const DynamicLine = ({ from, to }: DynamicLineProps) => {
  const lineRef = useRef<Line | null>(null)
  const { scene } = useThree() // size

  /* const [geometry, material] = useMemo(() => {
    const geo = new LineGeometry()
    const mat = new LineMaterial({
      // color,
      linewidth: width,
      resolution: new Vector2(size.width, size.height),
    })
    return [geo, mat]
  }, [width, size]) */

  const fromNode = useMemo(() => scene.getObjectByName(from), [scene, from])
  const toNode = useMemo(() => scene.getObjectByName(to), [scene, to])
  const fromPosition = useMemo(() => new Vector3(), [])
  const toPosition = useMemo(() => new Vector3(), [])

  useFrame(() => {
    if (lineRef.current && fromNode && toNode) {
      fromNode.getWorldPosition(fromPosition)
      toNode.getWorldPosition(toPosition)

      // Line
      lineRef.current.geometry.setFromPoints([fromPosition, toPosition])
      lineRef.current.geometry.attributes.position.needsUpdate = true

      // Line2
      // geometry.setPositions([...fromPosition, ...toPosition])
      // lineRef.current.computeLineDistances()
    }
  }) // @ts-expect-error line is falsely interpreted as SVG
  return <line ref={lineRef} />
  // return <primitive object={new Line2(geometry, material)} ref={lineRef} />
}
