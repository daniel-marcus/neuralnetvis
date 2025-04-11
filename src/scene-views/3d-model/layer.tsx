import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { useSpring } from "@react-spring/web"
import { useSceneStore } from "@/store"
import { useAnimatedPosition } from "@/scene-views/3d-model/utils"
import { NeuronGroup } from "./neuron-group"
import { YPointer } from "./pointer"
import { Connections } from "./connections"
import type { LayerStateful } from "@/neuron-layers/types"

type LayerProps = LayerStateful & { allLayers: LayerStateful[] }

export const Layer = (props: LayerProps) => {
  const { layerPos, groups, prevLayer } = props
  const ref = useLayerPos(props)
  const invisible = useIsInvisible(props)
  const prevInvisible = useIsInvisible(prevLayer)
  useDynamicScale(ref, invisible ? 0.1 : 1, 300)
  const [material, addBlend] = useAdditiveBlending(props.hasColorChannels) // TODO: share material
  const showConnections = !invisible && !!prevLayer && !prevInvisible
  if (!props.neurons.length) return null
  return (
    <>
      <group ref={ref} renderOrder={addBlend ? -1 : undefined}>
        {/* render layer w/ additive blending first (mixed colors) to avoid transparency to other objects */}
        {groups.map((group, i) => (
          <NeuronGroup key={i} {...props} group={group} material={material} />
        ))}
        {layerPos === "output" && <YPointer outputLayer={props} />}
      </group>
      {showConnections && <Connections layer={props} prevLayer={prevLayer} />}
    </>
  )
}

function useLayerPos(layer: LayerProps) {
  const { allLayers } = layer
  const visibleLayers = allLayers.filter((l) => l.neurons.length)
  const visibleIdx = visibleLayers.findIndex((l) => l.index === layer.index)

  const focussedLayerIdx = useSceneStore((s) => s.focussedLayerIdx)
  const offset = visibleLayers.findIndex((l) => l.index === focussedLayerIdx)

  const { xShift, yShift, zShift } = useSceneStore((s) => s.vis)

  const position = useMemo(() => {
    if (visibleIdx < 0) return [0, 0, 0]
    const x =
      offset >= 0
        ? ((visibleIdx - offset) * xShift) / 2
        : visibleIdx * xShift + (visibleLayers.length - 1) * xShift * -0.5
    return [
      x,
      visibleIdx * yShift + (visibleLayers.length - 1) * yShift * -0.5,
      visibleIdx * zShift + (visibleLayers.length - 1) * zShift * -0.5,
    ]
  }, [offset, visibleIdx, visibleLayers.length, xShift, yShift, zShift])

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
