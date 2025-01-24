import React, { useState, useEffect, useContext } from "react"
import { useStatusText } from "./status-text"
import { TrainingYContext } from "./model"

import { NeuronLabel, Pointer } from "./neuron-label"

import { numColorChannels, type Dataset, type NodeInput } from "@/lib/datasets"
import { useSelectedNodes } from "@/lib/node-select"
import { Instance } from "@react-three/drei"
import { ThreeEvent } from "@react-three/fiber"
import { LayerDef } from "./layer"
import { Object3D } from "three"

export type NodeId = string // layerIndex_{index3d.join(".")}
export type NeuronRefType = Object3D | null

export type Index3D = [number, number, number] // height, width, depth

export type NeuronDef = {
  index: number
  index3d: Index3D
  nid: NodeId
  layerIndex: number
  visibleLayerIndex: number
  position: [number, number, number]
  ref: React.RefObject<NeuronRefType>
}

type NeuronContext = {
  layer: LayerDef
  allLayers?: LayerDef[]
  ds?: Dataset
}

export type NeuronState = {
  rawInput?: NodeInput // maybe element of ... ?
  activation?: number
  normalizedActivation?: number
  inputs?: number[]
  weights?: number[]
  bias?: number
  label?: string
  isSelected?: boolean
  highlightValue?: number // [-1, 1]
  isDimmed?: boolean
}

export type NeuronProps = NeuronDef & NeuronContext & NeuronState

export function Neuron(props: NeuronProps) {
  const {
    index,
    ref,
    position,
    layer,
    rawInput,
    activation = 0,
    normalizedActivation = 0,
    label,
    ds,
    isSelected,
    highlightValue,
  } = props
  const nodeId = `${layer.index}_${index}`
  const { selectedNode, toggleNode } = useSelectedNodes()

  const [hovered, setHover] = useState(false)
  // const geometry = getGeometry(layer.layerPosition, layer.neurons.length)
  const trainingY = useContext(TrainingYContext)
  useHoverStatus(hovered, props)

  const isClassification = !ds?.input?.labels?.length

  const linearY = trainingY ?? 1
  const linearPredictionQuality = 1 - Math.abs(activation - linearY) / linearY
  const colorValue =
    isClassification || layer.layerPosition !== "output"
      ? normalizedActivation
      : linearPredictionQuality

  const hasColorChannels = numColorChannels(ds) > 1
  const rest = index % 3
  const colorArr = [0, 0, 0]
  colorArr[rest] = Math.ceil(colorValue * 255)
  const color =
    layer.layerPosition === "input" && hasColorChannels
      ? `rgb(${colorArr.join(", ")})`
      : // Array.isArray(rawInput) ? `rgb(${rawInput[0]}, ${rawInput[1]}, ${rawInput[2]})`
        `rgb(${Math.ceil(colorValue * 255)}, 20, 100)`

  const showValueLabel =
    !isClassification && ["input", "output"].includes(layer.layerPosition)
  const showPointer =
    layer.layerPosition === "output" &&
    typeof trainingY === "number" &&
    trainingY === index

  const highlightColor =
    typeof highlightValue === "number" ? getColor(highlightValue) : undefined

  return (
    <group name={`neuron_${nodeId}`}>
      <Instance
        ref={ref}
        name={nodeId}
        position={position}
        scale={isSelected ? 1.5 : 1}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          if (e.buttons) return
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
        onClick={() => {
          toggleNode(nodeId)
        }}
        color={highlightColor ?? color}
        transparent={!!selectedNode}
        opacity={!!selectedNode && !isSelected && !highlightColor ? 0.2 : 1}
      />
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
          {rawInput
            ? String(rawInput)
            : activation
            ? `${activation?.toFixed(0)} (predicted)\n${trainingY} (actual)`
            : ""}
        </NeuronLabel>
      )}
      {showPointer && (
        <Pointer
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

function useHoverStatus(hovered: boolean, props: NeuronProps) {
  const setStatusText = useStatusText((s) => s.setStatusText)
  useEffect(() => {
    if (hovered) {
      const { nid, rawInput, activation: _activation, bias } = props
      // TODO: handle multiple activations?
      const activation = Array.isArray(_activation)
        ? undefined // _activation[0]
        : _activation
      setStatusText(
        `<strong>Neuron ${nid}</strong><br/><br/>
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
