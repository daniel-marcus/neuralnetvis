import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { useSpring } from "@react-spring/web"
import { useSceneStore } from "@/store"
import { useAnimatedPosition, useIsClose } from "@/scene-views/3d-model/utils"
import { useLast } from "@/utils/helpers"
import { InstancedLayer } from "./layer-instanced"
import { TexturedLayer } from "./layer-textured"
import { YPointer } from "./pointer"
import { Connections } from "./connections"
import type { NeuronLayer } from "@/neuron-layers/types"

export const Layer = (
  props: NeuronLayer & { visibleLayers: NeuronLayer[] }
) => {
  const { layerPos, groups, prevLayer, hasColorChannels } = props
  const ref = useLayerPos(props, props.visibleLayers)
  const isFlatView = useSceneStore((s) => s.vis.flatView)
  const { isFocussed, wasFocussed, hasFocussed } = useFocussed(props.index)
  const invisible = useIsInvisible(props) || (isFlatView && !isFocussed)
  const prevInvisible = useIsInvisible(prevLayer)
  const scale = invisible ? 0.0001 : hasFocussed && !isFocussed ? 0.2 : 1
  const duration = isFlatView && !isFocussed && !wasFocussed ? 0 : 500
  useDynamicScale(ref, scale, duration)
  const showConnections =
    !invisible && !!prevLayer && !prevInvisible && !hasFocussed && !isFlatView

  const hasChannels = (props.tfLayer.outputShape[3] as number) ?? 1 > 1
  const isClose = useIsClose(ref, 30) // TODO: fix flickering when switching
  const showTextured =
    !!hasChannels && layerPos === "hidden" && !isFocussed && !isClose

  const textureLayer = <TexturedLayer {...props} />
  const instancedLayer = <InstancedLayer {...props} group={props.layerGroup} />

  if (!props.neurons.length || props.visibleIdx === -1) return null
  return (
    <>
      <group ref={ref}>
        {hasColorChannels
          ? groups.map((group, i) => (
              <InstancedLayer key={i} {...props} group={group} />
            ))
          : showTextured
          ? textureLayer
          : instancedLayer}
        {layerPos === "output" && <YPointer outputLayer={props} />}
      </group>
      {showConnections && <Connections layer={props} prevLayer={prevLayer} />}
    </>
  )
}

function useFocussed(layerIdx: number) {
  const focussedIdx = useSceneStore((s) => s.focussedLayerIdx)
  const isFocussed = focussedIdx === layerIdx
  const wasFocussed = useLast(isFocussed)
  const hasFocussed = typeof focussedIdx === "number"
  return { isFocussed, wasFocussed, hasFocussed }
}

function useLayerPos(layer: NeuronLayer, visibleLayers: NeuronLayer[]) {
  const visibleIdx = layer.visibleIdx
  const { xShift, yShift, zShift } = useSceneStore((s) => s.vis)

  const position = useMemo(() => {
    if (visibleIdx < 0) return [0, 0, 0]
    const getCoord = (shift: number) =>
      visibleIdx * shift + (visibleLayers.length - 1) * shift * -0.5
    return [getCoord(xShift), getCoord(yShift), getCoord(zShift)]
  }, [visibleIdx, visibleLayers.length, xShift, yShift, zShift])

  const [ref] = useAnimatedPosition(position, 0.1)
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
