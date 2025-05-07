import { memo, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { useSpring } from "@react-spring/web"
import { useSceneStore } from "@/store"
import { useAnimatedPosition, useIsClose } from "@/scene-views/3d-model/utils"
import { LayerInteractions } from "./interactions"
import { useLast } from "@/utils/helpers"
import { InstancedLayer } from "./layer-instanced"
import { TexturedLayer } from "./layer-textured"
import { YPointer } from "./pointer"
import type { NeuronLayer } from "@/neuron-layers/types"

export const Layer = memo(function Layer(props: NeuronLayer) {
  const measureRef = useRef<THREE.Mesh | null>(null)
  const separateChannels = props.hasColorChannels ? 3 : 1
  return (
    <LayerScaler {...props}>
      <group ref={measureRef}>
        {Array.from({ length: separateChannels }).map((_, i) => (
          <LodComp key={i} {...props} channelIdx={i} measureRef={measureRef} />
        ))}
      </group>
      <LayerInteractions {...props} measureRef={measureRef} />
      {props.layerPos === "output" && <YPointer outputLayer={props} />}
    </LayerScaler>
  )
})

interface LayerScalerProps extends NeuronLayer {
  children: React.ReactNode
}

function LayerScaler(props: LayerScalerProps) {
  const posRef = useLayerPos(props)
  const isFlatView = useSceneStore((s) => s.vis.flatView)
  const { isFocussed, wasFocussed, hasFocussed } = useFocussed(props.index)
  const invisible = useIsInvisible(props) || (isFlatView && !isFocussed)
  const scale = invisible ? 0.0001 : hasFocussed && !isFocussed ? 0.2 : 1
  const duration = isFlatView && !isFocussed && !wasFocussed ? 0 : 500
  useDynamicScale(posRef, scale, duration)
  return <group ref={posRef}>{props.children}</group>
}

interface LodCompProps extends NeuronLayer {
  channelIdx?: number
  measureRef: React.RefObject<THREE.Mesh | null>
}

function LodComp(props: LodCompProps) {
  // Level-of-Detail rendering: use less expensive TexturedLayer for distant & large layers
  const hasChannels = (props.tfLayer.outputShape[3] as number) ?? 1 > 1
  const isClose = useIsClose(props.measureRef, 40)
  const { isFocussed, hasFocussed } = useFocussed(props.index)
  const isScrolling = useSceneStore((s) => s.isScrolling)
  const isSuperLarge = props.numNeurons > 30000
  const alwaysInstanced = true // props.layerPos !== "hidden" || !hasChannels
  const showInstanced =
    alwaysInstanced ||
    (isFocussed && !isScrolling) ||
    (isClose && !hasFocussed && !isSuperLarge && !isScrolling)
  const LayerComp = showInstanced ? InstancedLayer : TexturedLayer
  return <LayerComp {...props} />
}

export function useFocussed(layerIdx: number) {
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const isFocussed = focussedIdx === layerIdx
  const wasFocussed = useLast(isFocussed)
  const hasFocussed = typeof focussedIdx === "number"
  return { isFocussed, wasFocussed, hasFocussed }
}

function useLayerPos(layer: NeuronLayer) {
  const visibleLayers = useSceneStore((s) => s.allLayers)
  const visibleIdx = layer.visibleIdx
  const { xShift, yShift, zShift } = useSceneStore((s) => s.vis)

  const position = useMemo(() => {
    if (visibleIdx < 0) return [0, 0, 0]
    const getCoord = (shift: number) =>
      visibleIdx * shift + (visibleLayers.length - 1) * shift * -0.5
    return [getCoord(xShift), getCoord(yShift), getCoord(zShift)]
  }, [visibleIdx, visibleLayers.length, xShift, yShift, zShift])

  const ref = useAnimatedPosition(position, 0.1)
  return ref
}

function useIsInvisible(layer?: NeuronLayer) {
  const invisibleLayers = useSceneStore((s) => s.vis.invisibleLayers)
  return invisibleLayers.includes(layer?.tfLayer.name ?? "")
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
