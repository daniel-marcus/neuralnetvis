import { Suspense, useContext, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Line, Matrix4, Quaternion, Vector2, Vector3 } from "three"
import { LayerDef } from "./layer"
import { Line2, LineGeometry, LineMaterial } from "three/examples/jsm/Addons.js"
import { NeuronRefType } from "./neuron"
import { UiOptionsContext } from "@/lib/ui-options"
import { useSelectedNodes } from "@/lib/node-select"

// TODO: find efficient olution without refs for instanced neurons ...

const DEBUG = false

const LINE_ACTIVATION_THRESHOLD = 0.5
const MAX_LINES_PER_LAYER = 100
const MIN_LINE_WIDTH = 0.1

type NeuronConnectionsProps = {
  layer: LayerDef
  prevLayer: LayerDef
}

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const { showLines } = useContext(UiOptionsContext)
  // TODO: refactor / separate from layer connections
  const selectedNode = useSelectedNodes((s) => s.selectedNode)
  const selN = selectedNode
    ? layer.neurons.find(({ nid }) => nid === selectedNode)
    : undefined
  const layerMaxWeight = useMemo(() => {
    const allWeights = layer.neurons.flatMap((n) => n.weights ?? [])
    return allWeights.reduce((max, w) => Math.max(max, w), -Infinity)
  }, [layer])
  if (!showLines) return null
  let lineCount = 0
  return (
    <Suspense fallback={null}>
      {!!selN && !!selN.inputNeurons && (
        <group name={`selected_node_connections`}>
          {selN.inputNeurons?.map((nid) => {
            const prevNeuron = prevLayer.neurons.find((n) => n.nid === nid)
            if (!prevNeuron) return null
            return (
              <DynamicLine2
                key={`${selN.index}_${prevNeuron.index}`}
                fromRef={prevNeuron.ref}
                toRef={selN.ref}
                width={0.5}
              />
            )
          })}
        </group>
      )}
      <group name={`layer_${layer.index}_connections`}>
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
              .filter(() => {
                if (lineCount > MAX_LINES_PER_LAYER) {
                  if (DEBUG) console.log("Max lines reached")
                  return false
                }
                return true
              })
              .filter(({ weight }) => weight > layerMaxWeight * 0.5)
              .sort((a, b) => b.weight - a.weight)
              .slice(0, maxLinesPerNeuron)
              .map(({ weight, index }) => {
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

export const DynamicLine2 = ({
  fromRef,
  toRef,
  width = 1,
}: DynamicLineProps) => {
  const lineRef = useRef<Line | null>(null)
  const { size } = useThree()

  const [geometry, material] = useMemo(
    () => [
      new LineGeometry(),
      new LineMaterial({
        linewidth: width,
        resolution: new Vector2(size.width, size.height),
      }),
    ],
    [width, size]
  )

  const [fromPosition, toPosition, tempMatrix, tempWorldMatrix] = useMemo(
    () => [new Vector3(), new Vector3(), new Matrix4(), new Matrix4()],
    []
  )
  useFrame(() => {
    if (lineRef.current && fromRef.current && toRef.current) {
      const { meshRef: fromMeshRef, indexInGroup: fromIndex } = fromRef.current
      const { meshRef: toMeshRef, indexInGroup: toIndex } = toRef.current
      if (!fromMeshRef?.current || !toMeshRef?.current) return

      fromMeshRef.current.getMatrixAt(fromIndex, tempMatrix)
      tempWorldMatrix.multiplyMatrices(
        fromMeshRef.current.matrixWorld,
        tempMatrix
      )
      tempWorldMatrix.decompose(fromPosition, new Quaternion(), new Vector3())

      toMeshRef.current.getMatrixAt(toIndex, tempMatrix)
      tempWorldMatrix.multiplyMatrices(
        toMeshRef.current.matrixWorld,
        tempMatrix
      )
      tempWorldMatrix.decompose(toPosition, new Quaternion(), new Vector3())

      geometry.setPositions([...fromPosition, ...toPosition])
      lineRef.current.computeLineDistances()
    }
  })

  return <primitive object={new Line2(geometry, material)} ref={lineRef} />
}
