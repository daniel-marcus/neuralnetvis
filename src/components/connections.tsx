import { useContext, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Line, Matrix4, Quaternion, Vector2, Vector3 } from "three"
import { LayerStateful, LayerStateless } from "./layer"
import { Line2, LineGeometry, LineMaterial } from "three/examples/jsm/Addons.js"
import { Neuron, NeuronRefType } from "./neuron"
import { VisOptionsContext } from "@/lib/vis-options"
import { useSelected } from "@/lib/neuron-select"

const MAX_LINES_PER_LAYER = 1000
const MIN_LINE_WIDTH = 0.1

type NeuronConnectionsProps = {
  layer: LayerStateful
  prevLayer: LayerStateless
}

export const HoverConnections = () => {
  const hovered = useSelected((s) => s.hovered)
  if (!hovered) return null
  // too many lines for fully connected layers
  // TODO: allowDenseHoverLines option
  if (hovered.layer.layerType === "Dense") return null
  return (
    <group name={`hovered_node_connections`}>
      {hovered.inputNeurons?.map((inputN, i) => {
        const prevNeuron = hovered.layer.prevLayer?.neuronsMap?.get(inputN.nid)
        if (!prevNeuron) return null
        return (
          <DynamicLine2
            key={i} // ${hovered.nid}_${prevNeuron.nid}
            fromRef={prevNeuron.ref}
            toRef={hovered.ref}
            width={0.5}
          />
        )
      })}
    </group>
  )
}

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const { showLines, lineActivationThreshold } = useContext(VisOptionsContext)
  const layerMaxWeight = layer.maxAbsWeight ?? 1
  const isConvOrMaxPool = ["Conv2D", "MaxPooling2D"].includes(layer.layerType)
  if (isConvOrMaxPool) return null
  if (!showLines) return null
  const connections = layer.neurons
    .filter((n) => (n.normalizedActivation ?? 0) >= lineActivationThreshold)
    .sort((a, b) => (b.activation ?? 0) - (a.activation ?? 0))
    .flatMap((neuron) => {
      const activation = neuron.normalizedActivation ?? 0
      if (activation < lineActivationThreshold) return null
      const { weights } = neuron
      if (!weights) return null
      // const maxLinesPerNeuron = Math.ceil(weights.length / 20) // max 5% of all weights
      return (
        weights
          .map((weight, index) => ({
            absWeight: Math.abs(weight),
            index,
          }))
          .filter(({ absWeight }) => absWeight >= layerMaxWeight * 0.5)
          .sort((a, b) => b.absWeight - a.absWeight) // TODO: optimize
          // .slice(0, maxLinesPerNeuron)
          .map(({ absWeight, index }) => {
            const prevNeuron = prevLayer.neurons[index]
            const input = neuron.inputs?.[index] ?? 0
            const weightedInput = absWeight * input
            if (weightedInput < MIN_LINE_WIDTH) return null
            const lineWidth = Math.round(weightedInput * 10) / 10
            return { neuron, prevNeuron, lineWidth }
          })
      )
    })
    .filter(Boolean)
    .slice(0, MAX_LINES_PER_LAYER) as {
    neuron: Neuron
    prevNeuron: Neuron
    lineWidth: number
  }[]
  return (
    <group name={`layer_${layer.index}_connections`}>
      {connections.map(({ neuron, prevNeuron, lineWidth }, i) => (
        <DynamicLine2
          key={i}
          fromRef={prevNeuron.ref}
          toRef={neuron.ref}
          width={lineWidth}
        />
      ))}
    </group>
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
      // console.log(fromMeshRef.current, toMeshRef.current, fromIndex, toIndex)
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
