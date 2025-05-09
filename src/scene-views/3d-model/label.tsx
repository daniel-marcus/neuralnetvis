import { memo, useMemo, useRef } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree } from "@react-three/fiber"
import { useSceneStore } from "@/store"
import { round } from "@/data/utils"
import { useActivation } from "@/model/activations"
import { useRawInput } from "@/data/sample"
import { getIndex3d } from "@/neuron-layers/neurons"
import { text2Canvas } from "./text-to-canvas"
import type { NeuronLayer } from "@/neuron-layers/types"

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
    <group>
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
  color?: string
  size?: number
}

export const NeuronLabel = memo(function NeuronLabel({
  text,
  position: [x, y, z] = [0, 0, 0],
  side = "right",
  color = LABEL_COLOR,
  size = 1,
}: NeuronLabelProps) {
  const labelRef = useRef<THREE.Object3D>(null)

  const camera = useThree((s) => s.camera)
  useFrame(() => labelRef.current?.lookAt(camera.position))

  const zOffset = side === "right" ? 3 : -3

  const [texture, scale, anchorPos] = useMemo(() => {
    text = text?.toString() ?? ""
    const align = side === "left" ? "right" : "left"
    const fontFace = "Menlo-Regular"
    const [canvas, numLines] = text2Canvas({ text, fontFace, color, align })
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const yScale = numLines
    const xScale = (canvas.width / canvas.height) * yScale
    const scale = [xScale, yScale, 0] as [number, number, number]
    const anchorOffset = side === "left" ? -xScale / 2 : xScale / 2
    const anchorPos = [anchorOffset, 0, 0] as [number, number, number]

    return [texture, scale, anchorPos] as const
  }, [text, color, side])

  const lightsOn = useSceneStore((s) => s.vis.lightsOn)
  if (!lightsOn) return null

  // spriteNodeMaterial didn't work with sprite.center, so using meshBasicMaterial + camera lookAt
  return (
    <group
      position={[x, y, z + size * zOffset]}
      rotation={[0, -Math.PI / 2, 0]}
      ref={labelRef}
      scale={size}
    >
      <sprite ref={labelRef} position={anchorPos} scale={scale}>
        <meshBasicMaterial map={texture} transparent />
      </sprite>
    </group>
  )
})
