import { memo, useLayoutEffect, useMemo, useRef } from "react"
import { useFrame, useThree, extend } from "@react-three/fiber"
import * as THREE from "three"
import { Text } from "troika-three-text"
import { useSceneStore } from "@/store"
import { round } from "@/data/utils"
import { useActivation } from "@/model/activations"
import { useRawInput } from "@/data/sample"
import { getIndex3d } from "@/neuron-layers/neurons"
import type { ThreeElement } from "@react-three/fiber"
import type { NeuronLayer } from "@/neuron-layers/types"

// https://r3f.docs.pmnd.rs/tutorials/typescript#extending-threeelements
// https://github.com/pmndrs/react-three-fiber/releases/tag/v9.0.0
class CustomText extends Text {}
extend({ CustomText })
declare module "@react-three/fiber" {
  interface ThreeElements {
    customText: ThreeElement<typeof CustomText>
  }
}

export const LABEL_COLOR = "rgb(150, 156, 171)"

interface NeuronLabelsProps {
  neuronIdx: number
  layer: NeuronLayer
  position?: [number, number, number]
  size?: number
  label?: string
}

export function NeuronLabels(props: NeuronLabelsProps) {
  const layerPos = props.layer.layerPos
  const isRegression = useSceneStore((s) => s.isRegression())
  const label = useLabelFromDs(props.layer, props.neuronIdx)
  if (isRegression) {
    const Comp = layerPos === "input" ? InputValueLabel : OutputValueLabel
    return <Comp {...props} label={label} />
  }
  const side = layerPos === "input" ? "left" : "right"
  return <NeuronLabel {...props} text={label} side={side} />
}

function useLabelFromDs(layer: NeuronLayer, neuronIdx: number) {
  const ds = useSceneStore((s) => s.ds)
  return useMemo(() => {
    const index3d = getIndex3d(neuronIdx, layer.tfLayer.outputShape as number[])
    return layer.layerPos === "input" && index3d[1] === 0 && index3d[2] === 0
      ? ds?.inputLabels?.[index3d[0]]
      : layer.layerPos === "output"
      ? ds?.outputLabels?.[neuronIdx]
      : undefined
  }, [layer, neuronIdx, ds])
}

function InputValueLabel(props: NeuronLabelsProps) {
  const rawInput = useRawInput(props.layer.index, props.neuronIdx)
  return (
    <group renderOrder={-1}>
      <NeuronLabel side="left" {...props} text={props.label} />
      <NeuronLabel {...props} text={round(rawInput)} />
    </group>
  )
}

function OutputValueLabel(props: NeuronLabelsProps) {
  const activation = useActivation(props.layer.index, props.neuronIdx)
  const trainingY = useSceneStore((s) => s.sample?.y)
  const text = `${props.label}\n${round(activation)} (predicted)\n${round(
    trainingY
  )} (actual)`
  return <NeuronLabel side="right" {...props} text={text} />
}

interface NeuronLabelProps {
  text?: string | number
  position?: [number, number, number]
  side?: "left" | "right"
  color?: THREE.Color | string
  size?: number
}

// reference: https://github.com/pmndrs/drei/blob/master/src/core/Text.tsx

export const NeuronLabel = memo(function NeuronLabel({
  text,
  position: [x, y, z] = [0, 0, 0],
  side = "right",
  color = LABEL_COLOR,
  size = 1,
}: NeuronLabelProps) {
  const labelRef = useRef<THREE.Object3D & CustomText>(null)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  useFrame(() => labelRef.current?.lookAt(camera.position))
  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  useLayoutEffect(() => {
    labelRef.current?.sync(invalidate)
  }, [labelRef, invalidate, text, lightsOn])
  const zOffset = side === "right" ? 3.5 : -3.5
  if (!lightsOn) return null
  return (
    <customText
      ref={labelRef}
      text={text}
      position={[x, y, z + size * zOffset]}
      fontSize={size}
      font={"/fonts/Menlo-Regular.woff"}
      color={color}
      anchorX={side === "left" ? "right" : "left"}
      anchorY="middle"
      rotation={[0, -Math.PI / 2, 0]}
    />
  )
})
