import { memo, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three/webgpu"
import { useThree } from "@react-three/fiber"
import { useSpring } from "@react-spring/web"
import { useSceneStore } from "@/store"
import { useAnimatedPosition, useIsClose } from "@/scene-views/3d-model/utils"
import { LayerInteractions } from "./interactions"
import { useLast } from "@/utils/helpers"
import { InstancedLayer, useNeuronSpacing } from "./layer-instanced"
import { TexturedLayer } from "./layer-textured"
import { useIsScreen } from "@/utils/screen"
import { getGridSize } from "@/neuron-layers/layout"
import type { NeuronLayer } from "@/neuron-layers/types"

interface LayerProps extends NeuronLayer {
  visibleLayers: NeuronLayer[]
}

export const Layer = memo(function Layer(props: LayerProps) {
  const measureRef = useRef<THREE.Mesh | null>(null)
  const separateChannels = props.hasColorChannels ? 3 : 1
  return (
    <LayerScaler {...props}>
      <LayerInteractions {...props} measureRef={measureRef} />
      <group ref={measureRef}>
        {Array.from({ length: separateChannels }).map((_, i) => (
          <ColorChannelShifter {...props} channelIdx={i} key={i}>
            <LodComp {...props} channelIdx={i} measureRef={measureRef} />
          </ColorChannelShifter>
        ))}
      </group>
    </LayerScaler>
  )
})

interface ColorChannelShifterProps extends LayerProps {
  channelIdx: number
  children: React.ReactNode
}

function ColorChannelShifter({ children, ...props }: ColorChannelShifterProps) {
  const groupRef = useGroupPosition(props, props.channelIdx)
  return (
    <group ref={groupRef} name={`group_${props.lid}_${props.channelIdx}`}>
      {children}
    </group>
  )
}

function useGroupPosition(layer: NeuronLayer, chnlIdx = 0) {
  // only used for color channels
  const { meshParams, hasColorChannels } = layer
  const numChannels = hasColorChannels ? 3 : 1
  const { spacedSize } = useNeuronSpacing(meshParams)
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  const [, h, w = 1] = layer.tfLayer.outputShape as number[]
  const position = useMemo(() => {
    const [gHeight] = getGridSize(h, w, spacedSize, spacedSize)

    const OFFSET_X = 0.05 // to avoid z-fighting // without logarithmicDepthBuffer higer values might be needed: h > 200 ? 0.5 : 0.05
    const OFFSET_YZ = 0.05
    const splitY = -chnlIdx * gHeight + (numChannels - 1) * gHeight * 0.5
    return hasColorChannels
      ? splitColors
        ? [-chnlIdx * OFFSET_X, splitY, chnlIdx * OFFSET_YZ] // spread on y-axis
        : [chnlIdx * OFFSET_X, -chnlIdx * OFFSET_YZ, -chnlIdx * OFFSET_YZ]
      : [0, 0, 0]
  }, [chnlIdx, numChannels, spacedSize, splitColors, h, w, hasColorChannels])
  const groupRef = useAnimatedPosition(position, 0.1)
  return groupRef
}

interface LayerScalerProps extends LayerProps {
  children: React.ReactNode
}

function LayerScaler(props: LayerScalerProps) {
  const [posRef, visibleIdx] = useLayerPos(props)
  const isFlatView = useSceneStore((s) => s.vis.flatView)
  const { isFocussed, wasFocussed, hasFocussed } = useFocussed(props.index)
  const isExcluded = useIsExcluded(props)
  const invisible = isExcluded || (isFlatView && !isFocussed) || visibleIdx < 0
  const showHiddenLayers = useSceneStore((s) => s.vis.showHiddenLayers)
  const isLargeInput =
    props.layerPos === "input" && props.numNeurons >= 96 * 96 * 3
  const scale = invisible
    ? 0.0001
    : hasFocussed && !isFocussed
    ? 0.2
    : isLargeInput && !showHiddenLayers
    ? (1 / Math.sqrt(props.numNeurons / 3)) * 96 // scale down large input layers
    : 1
  const duration =
    isExcluded || visibleIdx < 0 || (isFlatView && !isFocussed && !wasFocussed)
      ? 0
      : 500
  useDynamicScale(posRef, scale, duration)
  return (
    <group ref={posRef} visible={visibleIdx >= 0}>
      {props.children}
    </group>
  )
}

interface LodCompProps extends NeuronLayer {
  channelIdx: number
  measureRef: React.RefObject<THREE.Mesh | null>
}

function LodComp(props: LodCompProps) {
  // Level-of-Detail rendering: use less expensive TexturedLayer for distant & large layers
  const hasChannels = (props.tfLayer.outputShape[3] as number) ?? 1 > 1
  const isClose = useIsClose(props.measureRef, 40)
  const { isFocussed, hasFocussed } = useFocussed(props.index)
  const isScrolling = useSceneStore((s) => s.isScrolling)
  const isScreenSm = useIsScreen("sm")
  const alwaysInstanced = !hasChannels || props.numNeurons <= 3072
  const alwaysTextured = isScreenSm
    ? !alwaysInstanced && props.numNeurons > 50000 // large layers: prefer less expensive TexturedLayer
    : !alwaysInstanced // mobile: use mainly TexturedLayer and avoid duplicate layers
  const showInstanced =
    alwaysInstanced ||
    (!alwaysTextured &&
      ((isFocussed && !isScrolling) ||
        (isClose && !hasFocussed && !isScrolling)))
  return (
    <>
      {!alwaysTextured && <InstancedLayer {...props} visible={showInstanced} />}
      {!alwaysInstanced && (
        <TexturedLayer {...props} visible={!showInstanced} />
      )}
    </>
  )
}

export function useFocussed(layerIdx: number) {
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const isFocussed = focussedIdx === layerIdx
  const wasFocussed = useLast(isFocussed)
  const hasFocussed = typeof focussedIdx === "number"
  return { isFocussed, wasFocussed, hasFocussed }
}

function useLayerPos(layer: LayerProps) {
  const { visibleLayers } = layer
  const visibleIdx = visibleLayers.findIndex((l) => l.index === layer.index)
  const { xShift, yShift, zShift } = useSceneStore((s) => s.vis)

  const position = useMemo(() => {
    if (visibleIdx < 0) return [0, 0, 0]
    const getCoord = (shift: number) =>
      visibleIdx * shift + (visibleLayers.length - 1) * shift * -0.5
    return [getCoord(xShift), getCoord(yShift), getCoord(zShift)]
  }, [visibleIdx, visibleLayers.length, xShift, yShift, zShift])

  const ref = useAnimatedPosition(position, 0.1)

  return [ref, visibleIdx] as const
}

function useIsExcluded(layer?: NeuronLayer) {
  const excludedLayers = useSceneStore((s) => s.vis.excludedLayers)
  return excludedLayers.includes(layer?.tfLayer.name ?? "")
}

function useDynamicScale(
  ref: React.RefObject<THREE.Mesh | null>,
  scale: number = 1,
  duration = 200
) {
  const invalidate = useThree(({ invalidate }) => invalidate)
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])
  // would use @react-spring/three, but that breaks @react-spring/web:
  // https://github.com/pmndrs/react-spring/issues/1586
  useSpring({
    scale: isMounted ? scale : 1,
    config: { duration },
    onChange: ({ value }) => {
      const val = value.scale
      ref.current?.scale.set(val, val, val)
      invalidate()
    },
  })
}
