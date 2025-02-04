import { useEffect, useMemo, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { Line, Matrix4, Quaternion, Vector2, Vector3 } from "three"
import { LayerStateful, LayerStateless } from "./layer"
import {
  LineGeometry,
  LineMaterial,
  LineSegments2,
} from "three/examples/jsm/Addons.js"
import { Neuron, NeuronRefType } from "@/lib/neuron"
import { useSelected } from "@/lib/neuron-select"
import { useVisConfigStore } from "@/lib/vis-config"
import { useDatasetStore } from "@/lib/datasets"

const MAX_LINES_PER_LAYER = 1000
const MIN_LINE_WIDTH = 0.1
const MAX_LINE_WIDTH = 3

type NeuronConnectionsProps = {
  layer: LayerStateful
  prevLayer: LayerStateless
}

export const HoverConnections = () => {
  const hovered = useSelected((s) => s.hovered)
  // too many lines for fully connected layers
  const allowDenseHoverLines = useVisConfigStore((s) => s.allowDenseHoverLines)
  if (!hovered) return null
  if (hovered.layer.layerType === "Dense" && !allowDenseHoverLines) return null
  return (
    <group name={`hovered_node_connections`}>
      {hovered.inputNeurons?.map((inputN, i, arr) => {
        const prevNeuron = hovered.layer.prevVisibleLayer?.neuronsMap?.get(
          inputN.nid
        )
        if (!prevNeuron) return null
        const width = arr.length > 100 ? 0.1 : 0.5
        return (
          <DynamicLine2
            key={`${hovered.nid}_${prevNeuron.nid}`}
            fromRef={prevNeuron.ref}
            toRef={hovered.ref}
            width={width}
          />
        )
      })}
    </group>
  )
}

export const Connections = ({ layer, prevLayer }: NeuronConnectionsProps) => {
  const showLines = useVisConfigStore((s) => s.showLines)
  const lineActivationThreshold = useVisConfigStore(
    (s) => s.lineActivationThreshold
  )
  const layerMaxWeight = layer.maxAbsWeight ?? 1
  const isConvOrMaxPool = ["Conv2D", "MaxPooling2D"].includes(layer.layerType)
  const isRegression = useDatasetStore((s) => s.isRegression())
  if (isRegression) return null
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
            const lineWidth = Math.min(
              Math.round(weightedInput * 10) / 10,
              MAX_LINE_WIDTH
            )
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

const DynamicLine2 = ({ fromRef, toRef, width = 1 }: DynamicLineProps) => {
  const lineRef = useRef<Line | null>(null)
  const { size } = useThree()

  const geometry = useMemo(() => new LineGeometry(), [])

  const material = useMemo(
    () =>
      new LineMaterial({
        linewidth: width,
        resolution: new Vector2(size.width, size.height),
      }),
    [width, size]
  )
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

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

  const obj = useMemo(
    () => new LineSegments2(geometry, material),
    [geometry, material]
  )

  return <primitive object={obj} ref={lineRef} />
}
