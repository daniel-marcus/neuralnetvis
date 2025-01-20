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

interface NeuronProps {
  index: number
  position: [number, number, number]
  layer: LayerProps
  prevLayer?: LayerProps
  rawInput?: number
  activation?: number
  normalizedActivation?: number
  weights?: number[]
  bias?: number
  label?: string
  ds: Dataset
}

export function Neuron(props: NeuronProps) {
  const {
    index,
    position,
    layer,
    prevLayer,
    // prevLayerPositions,
    rawInput,
    activation = 0,
    normalizedActivation = 0,
    weights,
    bias,
    label,
    ds,
  } = props
  const [hovered, setHover] = useState(false)
  const geometry = getGeometry(layer.layerPosition, layer.units)
  const { hideLines } = useContext(OptionsContext)
  const trainingY = useContext(TrainingYContext)
  useHoverStatus(hovered, props)

  const isClassification = !ds.input?.labels?.length

  const linearY = trainingY ?? 1
  //  TODO: use R squared?
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
  return (
    <group>
      <mesh
        position={position}
        userData={{ activation, bias }}
        scale={1}
        onPointerOver={(e) => {
          if (e.buttons) return
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        {geometry}
        <meshStandardMaterial color={color} />
      </mesh>
      {showLines && (
        <NeuronConnections
          linePoints={linePoints}
          weights={weights}
          inputs={prevLayer?.activations}
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
      const { index, layer, rawInput, activation, weights, bias } = props
      const layerIndex = layer.index ?? 0
      const weightObjects = weights?.map((w, i) => ({ w, i }))
      const strongestWeights = weightObjects
        // ?.filter((o) => Math.abs(o.w) > LINE_WEIGHT_THRESHOLD)
        ?.toSorted((a, b) => Math.abs(b.w) - Math.abs(a.w))
        .slice(0, 5)
      const weightsText = strongestWeights?.length
        ? `<br/>Top weights:<br/>${strongestWeights
            .map((o) => `Neuron ${layerIndex - 1}_${o.i} (${o.w.toFixed(4)})`)
            .join("<br/>")}`
        : ""
      setStatusText(
        `<strong>Neuron ${layerIndex}_${index}</strong><br/><br/>
${rawInput !== undefined ? `Raw Input: ${rawInput}<br/>` : ""}
Activation: ${activation?.toFixed(4)}<br/>
${bias !== undefined ? `Bias: ${bias?.toFixed(4)}<br/>` : ""}
${weightsText}`
      )
      return () => {
        setStatusText("")
      }
    }
  }, [hovered, props, setStatusText])
}
