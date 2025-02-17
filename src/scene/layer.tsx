import { useEffect, useMemo, useState } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { useSpring } from "@react-spring/web"
import { useAnimatedPosition } from "@/scene/utils"
import { useOrientation } from "@/utils/screen"
import { NeuronGroup } from "./neuron-group"
import { YPointer } from "./pointer"
import { Connections } from "./connections"
import type { LayerStateful } from "@/neuron-layers/types"
import { useStore } from "@/store"

type LayerProps = LayerStateful & { allLayers: LayerStateful[] }

export const Layer = (props: LayerProps) => {
  const { layerPos, groups, prevLayer } = props
  const ref = useLayerPos(props)
  const invisible = useIsInvisible(props)
  const prevInvisible = useIsInvisible(prevLayer)
  useDynamicScale(ref, invisible ? 0.001 : 1)
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
  const { visibleIdx, allLayers } = layer
  const visibleLayers = allLayers.filter((l) => l.neurons.length)
  const orientation = useOrientation()

  const { xShift, yShift, zShift } = useStore((s) => s.vis)

  const position = useMemo(() => {
    const xShiftN = orientation === "landscape" ? xShift : xShift * 0.8
    return [
      visibleIdx * xShiftN + (visibleLayers.length - 1) * xShiftN * -0.5,
      visibleIdx * yShift + (visibleLayers.length - 1) * yShift * -0.5,
      visibleIdx * zShift + (visibleLayers.length - 1) * zShift * -0.5,
    ]
  }, [visibleIdx, visibleLayers.length, xShift, yShift, zShift, orientation])

  const [ref] = useAnimatedPosition(position, 0.1)
  return ref
}

function useIsInvisible(layer?: LayerStateful) {
  const invisibleLayers = useStore((s) => s.vis.invisibleLayers)
  return invisibleLayers.includes(layer?.tfLayer.name ?? "")
}

function useDynamicScale(
  ref: React.RefObject<THREE.Mesh | null>,
  scale: number = 1
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
    config: { duration: 150 },
    onChange: ({ value }) => {
      const val = value.scale
      ref.current?.scale.set(val, val, val)
      invalidate()
    },
  })
}

export function useAdditiveBlending(hasColorChannels: boolean) {
  const splitColors = useStore((s) => s.vis.splitColors)
  const active = hasColorChannels && !splitColors
  const material = useMemo(() => new THREE.MeshStandardMaterial(), [])
  useEffect(() => {
    const blending = active ? THREE.AdditiveBlending : THREE.NormalBlending
    material.blending = blending
    material.needsUpdate = true
  }, [material, active])
  return [material, active] as const
}
