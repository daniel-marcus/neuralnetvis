import React, {
  useState,
  ReactElement,
  useEffect,
  useContext,
  useMemo,
} from "react"
import { useStatusText } from "./status-text"
import { OptionsContext, TrainingYContext } from "./model"

import type { LayerProps, LayerPosition, Point } from "./sequential"

import { Dot, NeuronLabel } from "./neuron-label"
import {
  LINE_ACTIVATION_THRESHOLD,
  NeuronConnections,
} from "./neuron-connections"

import type { Dataset } from "@/lib/datasets"
import { NodeId, useSelectedNodes } from "@/lib/node-select"

export type NeuronDef = {
  index: number
  nid: NodeId
  layerIndex: number
}

type NeuronContext = {
  position: [number, number, number]
  layer: LayerProps
  allLayers?: LayerProps[]
  ds: Dataset
}

export type NeuronState = {
  rawInput?: number
  activation?: number
  normalizedActivation?: number
  weights?: number[]
  normalizedWeights?: number[]
  bias?: number
  weightedInputs?: number[]
  label?: string
  isSelected?: boolean
  highlightValue?: number // [-1, 1]
  isDimmed?: boolean
}

export type NeuronProps = NeuronDef & NeuronContext & NeuronState

export function Neuron(props: NeuronProps) {
  const {
    index,
    position,
    layer,
    allLayers,
    rawInput,
    activation = 0,
    normalizedActivation = 0,
    weights,
    bias,
    label,
    ds,
    isSelected,
    highlightValue,
  } = props
  const nodeId = `${layer.index}_${index}`
  const { selectedNode, toggleNode } = useSelectedNodes()

  const prevLayer = allLayers?.[layer.index - 1]

  const [hovered, setHover] = useState(false)
  const geometry = getGeometry(layer.layerPosition, layer.neurons.length)
  const { hideLines } = useContext(OptionsContext)
  const trainingY = useContext(TrainingYContext)
  useHoverStatus(hovered, props)

  const isClassification = !ds.input?.labels?.length

  const linearY = trainingY ?? 1
  const linearPredictionQuality = 1 - Math.abs(activation - linearY) / linearY
  const colorValue =
    isClassification || layer.layerPosition !== "output"
      ? normalizedActivation
      : linearPredictionQuality
  const color = `rgb(${Math.ceil(colorValue * 255)}, 20, 100)`

  const showValueLabel =
    !isClassification && ["input", "output"].includes(layer.layerPosition)
  const showDot =
    layer.layerPosition === "output" &&
    typeof trainingY === "number" &&
    trainingY === index
  const showLines =
    !!prevLayer &&
    !hideLines &&
    Number(normalizedActivation) >= LINE_ACTIVATION_THRESHOLD &&
    isClassification

  const linePoints = useMemo(() => {
    if (!prevLayer?.positions) return []
    return prevLayer?.positions?.map((prevPos) => [prevPos, position]) ?? []
  }, [prevLayer?.positions, position]) as [Point, Point][]

  const highlightColor =
    typeof highlightValue === "number" ? getColor(highlightValue) : undefined

  return (
    <group name={`neuron_${nodeId}`}>
      <mesh
        position={position}
        userData={{ activation, bias }}
        scale={isSelected ? 1.5 : 1}
        onPointerOver={(e) => {
          if (e.buttons) return
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
        onClick={() => {
          toggleNode(nodeId)
        }}
      >
        {geometry}
        <meshStandardMaterial
          color={highlightColor ?? color}
          transparent={true}
          // opacity={!!selectedNode && !!highlightValue ? Math.max(highlightValue, 0) : 1}
          opacity={!!selectedNode && !isSelected && !highlightColor ? 0.2 : 1}
        />
      </mesh>
      {showLines && !selectedNode && (
        <NeuronConnections
          linePoints={linePoints}
          weights={weights}
          inputs={prevLayer?.neurons.map((n) => n.activation)}
        />
      )}
      {!!label && (
        <NeuronLabel
          side={isClassification ? "right" : "left"}
          position={position}
          color={color}
        >
          {label}
        </NeuronLabel>
      )}
      {showValueLabel && (
        <NeuronLabel side={"right"} position={position} color={color}>
          {rawInput ??
            (activation
              ? `${activation?.toFixed(0)} (predicted)\n${trainingY} (actual)`
              : "")}
        </NeuronLabel>
      )}
      {showDot && (
        <Dot
          position={position}
          color={Number(activation) > 0.5 ? "rgb(0, 200, 80)" : "white"}
        />
      )}
    </group>
  )
}

function getColor(
  value: number, // between -1 and 1
  base: [number, number, number] = [250, 20, 100]
) {
  const absVal = Math.abs(value)
  const a = Math.ceil(absVal * base[0])
  const b = Math.ceil(absVal * base[1])
  const c = Math.ceil(absVal * base[2])
  return value > 0 ? `rgb(${a}, ${b}, ${c})` : `rgb(${c}, ${b}, ${a})` // `rgb(${b}, ${a}, ${c})` //
}

const geometryMap: Record<string, ReactElement> = {
  boxSmall: <boxGeometry args={[0.6, 0.6, 0.6]} />,
  boxBig: <boxGeometry args={[1.8, 1.8, 1.8]} />,
  sphere: <sphereGeometry args={[0.6, 32, 32]} />,
}

function getGeometry(type: LayerPosition, units: number) {
  if (["input", "output"].includes(type)) {
    if (units <= 10) return geometryMap.boxBig
    return geometryMap.boxSmall
  }
  return geometryMap.sphere
}

function useHoverStatus(hovered: boolean, props: NeuronProps) {
  const setStatusText = useStatusText((s) => s.setStatusText)
  useEffect(() => {
    if (hovered) {
      const { index, layer, rawInput, activation, bias } = props
      const layerIndex = layer.index ?? 0
      setStatusText(
        `<strong>Neuron ${layerIndex}_${index}</strong><br/><br/>
${rawInput !== undefined ? `Raw Input: ${rawInput}<br/>` : ""}
Activation: ${activation?.toFixed(4)}<br/>
${
  bias !== undefined
    ? `Bias: ${bias?.toFixed(4)}<br/><br/>Click to see influencs`
    : ""
}`
      )
      return () => {
        setStatusText("")
      }
    }
  }, [hovered, props, setStatusText])
}
