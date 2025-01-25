import React, { useContext } from "react"
import { TrainingYContext } from "./model"

import { NeuronLabel, Pointer } from "./neuron-label"

import { numColorChannels, type Dataset, type NodeInput } from "@/lib/datasets"
import { useSelectedNodes } from "@/lib/node-select"
import { Instance } from "@react-three/drei"
import { LayerDef } from "./layer"
import { InstancedMeshRef } from "./neuron-group"

// refactoring in progress, kept only for type definitions, all logic is handled in NeuronGroupInstanced now

export type NodeId = string // layerIndex_{index3d.join(".")}
export type NeuronRefType = {
  meshRef: InstancedMeshRef
  indexInGroup: number
} | null // Object3D | null

export type Index3D = [number, number, number] // height, width, depth

export type NeuronDef = {
  index: number
  index3d: Index3D
  nid: NodeId
  layerIndex: number
  visibleLayerIndex: number
  position: [number, number, number]
  ref: React.RefObject<NeuronRefType>
  hasColorChannels?: boolean
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
  inputNeurons?: NodeId[] // for Conv2D: neurons in the receptive field
  label?: string
  isSelected?: boolean
  highlightValue?: number // [-1, 1]
  isDimmed?: boolean
}

export type NeuronProps = NeuronDef & NeuronContext & NeuronState

export function Neuron(props: NeuronProps) {
  const {
    nid,
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
  } = props
  const { selectedNode } = useSelectedNodes()
  const trainingY = useContext(TrainingYContext)

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

  return (
    <group name={`neuron_${nid}`}>
      <Instance
        ref={ref}
        name={nid}
        position={position}
        scale={isSelected ? 1.5 : 1}
        transparent={!!selectedNode} // TODO: fix
        // opacity={!!selectedNode && !isSelected && !highlightColor ? 0.2 : 1}
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
