import { Suspense, useContext, useMemo, useRef } from "react"
import { OptionsContext } from "./model"
import { useFrame, useThree } from "@react-three/fiber"
import { Line, Vector2, Vector3 } from "three"
import { LayerDef } from "./layer"
import { Line2, LineGeometry, LineMaterial } from "three/examples/jsm/Addons.js"
import { NeuronRefType } from "./neuron"

export const LINE_ACTIVATION_THRESHOLD = 0.5
const MAX_LINES_PER_LAYER = 200
const MIN_LINE_WIDTH = 0.1

type NeuronConnectionsProps = {
  layer: LayerDef
  prevLayer: LayerDef
}

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const { hideLines } = useContext(OptionsContext)
  const layerMaxWeight = useMemo(() => {
    const allWeights = layer.neurons.flatMap((n) => n.weights ?? [])
    return allWeights.reduce((max, w) => Math.max(max, w), -Infinity)
  }, [layer])
  if (hideLines) return null
  let lineCount = 0
  return (
    <Suspense fallback={null}>
      <group>
        {layer.neurons
          .filter(
            (n) => (n.normalizedActivation ?? 0) > LINE_ACTIVATION_THRESHOLD
          )
          .sort((a, b) => (b.activation ?? 0) - (a.activation ?? 0))
          .map((neuron) => {
            const activation = neuron.normalizedActivation ?? 0
            if (activation < LINE_ACTIVATION_THRESHOLD) return null
            const { weights } = neuron
            if (!weights) return null
            const maxLinesPerNeuron = Math.ceil(weights.length / 20) // max 5% of all weights
            return weights
              .map((weight) => ({ weight, index: weights.indexOf(weight) }))
              .filter(({ weight }) => weight > layerMaxWeight * 0.5)
              .sort((a, b) => b.weight - a.weight)
              .slice(0, maxLinesPerNeuron)
              .map(({ weight, index }) => {
                if (lineCount > MAX_LINES_PER_LAYER) {
                  console.log("Max lines reached")
                  return null
                }
                const prevNeuron = prevLayer.neurons[index]
                const prevActivation = prevNeuron?.activation ?? 0
                const weightedInput = weight * prevActivation
                if (weightedInput < MIN_LINE_WIDTH) return null
                const lineWidth = Math.round(weightedInput * 10) / 10
                lineCount++
                return (
                  <DynamicLine2
                    key={`${neuron.index}_${prevNeuron.index}`}
                    fromRef={prevNeuron.ref}
                    toRef={neuron.ref}
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
  fromRef: React.RefObject<NeuronRefType>
  toRef: React.RefObject<NeuronRefType>
  width?: number
}

export const DynamicLine = ({ fromRef, toRef }: DynamicLineProps) => {
  // has always width = 1
  const lineRef = useRef<Line | null>(null)

  const fromPosition = useMemo(() => new Vector3(), [])
  const toPosition = useMemo(() => new Vector3(), [])

  useFrame(() => {
    if (lineRef.current && fromRef.current && toRef.current) {
      fromRef.current.getWorldPosition(fromPosition)
      toRef.current.getWorldPosition(toPosition)

      lineRef.current.geometry.setFromPoints([fromPosition, toPosition])
      lineRef.current.geometry.attributes.position.needsUpdate = true
    }
  })
  // @ts-expect-error line is falsely interpreted as SVG
  return <line ref={lineRef} />
}

const DynamicLine2 = ({ fromRef, toRef, width }: DynamicLineProps) => {
  const lineRef = useRef<Line | null>(null)
  const { size } = useThree()

  const [geometry, material] = useMemo(() => {
    const geo = new LineGeometry()
    const mat = new LineMaterial({
      // color,
      linewidth: width,
      resolution: new Vector2(size.width, size.height),
    })
    return [geo, mat]
  }, [width, size])

  const fromPosition = useMemo(() => new Vector3(), [])
  const toPosition = useMemo(() => new Vector3(), [])

  useFrame(() => {
    if (lineRef.current && fromRef.current && toRef.current) {
      fromRef.current.getWorldPosition(fromPosition)
      toRef.current.getWorldPosition(toPosition)

      geometry.setPositions([...fromPosition, ...toPosition])
      lineRef.current.computeLineDistances()
    }
  })
  return <primitive object={new Line2(geometry, material)} ref={lineRef} />
}
