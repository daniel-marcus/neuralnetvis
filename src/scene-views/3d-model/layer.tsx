import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { useSpring } from "@react-spring/web"
import { useSceneStore } from "@/store"
import { useAnimatedPosition } from "@/scene-views/3d-model/utils"
import { useLast } from "@/utils/helpers"
import { NeuronGroup } from "./neuron-group"
import { YPointer } from "./pointer"
import { Connections } from "./connections"
import type { LayerStateful } from "@/neuron-layers/types"

type LayerProps = LayerStateful & { allLayers: LayerStateful[] }

export const Layer = (props: LayerProps) => {
  const { layerPos, groups, prevLayer, hasColorChannels } = props
  const ref = useLayerPos(props)
  const isFlatView = useSceneStore((s) => s.vis.flatView)
  const { isFocussed, wasFocussed, hasFocussed } = useFocussed(props.index)
  const invisible = useIsInvisible(props) || (isFlatView && !isFocussed)
  const prevInvisible = useIsInvisible(prevLayer)
  const scale = invisible ? 0.0001 : hasFocussed && !isFocussed ? 0.2 : 1
  const duration = isFlatView && !isFocussed && !wasFocussed ? 0 : 500
  useDynamicScale(ref, scale, duration)
  const [material, addBlend] = useAdditiveBlending(hasColorChannels) // TODO: share material?
  const showConnections =
    !invisible && !!prevLayer && !prevInvisible && !hasFocussed && !isFlatView
  if (!props.neurons.length || props.visibleIdx === -1) return null
  return (
    <>
      <group ref={ref} renderOrder={addBlend ? -1 : undefined}>
        {/* render layer w/ additive blending first (mixed colors) to avoid transparency to other objects */}
        {!hasColorChannels ? (
          <NeuronGroup
            {...props}
            group={props.layerGroup}
            material={material}
          />
        ) : (
          groups.map((group, i) => (
            <NeuronGroup key={i} {...props} group={group} material={material} />
          ))
        )}
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

function useLayerPos(layer: LayerProps) {
  const { allLayers } = layer
  const visibleLayers = allLayers.filter(
    (l) => l.visibleIdx >= 0 && l.neurons.length
  )
  const visibleIdx = visibleLayers.findIndex((l) => l.index === layer.index)

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

function useIsInvisible(layer?: LayerStateful) {
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

export function useAdditiveBlending(hasColorChannels: boolean) {
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  const active = hasColorChannels && !splitColors
  const material = useMemo(() => new THREE.MeshStandardMaterial(), [])
  useEffect(() => {
    const blending = active ? THREE.AdditiveBlending : THREE.NormalBlending
    material.blending = blending
    material.needsUpdate = true
  }, [material, active])
  return [material, active] as const
}
