import { useEffect, useMemo } from "react"
import * as THREE from "three"
import { useThree } from "@react-three/fiber"
import { useSpring } from "@react-spring/web"
import { useAnimatedPosition } from "@/scene/utils"
import { useVisConfigStore } from "@/scene/vis-config"
import { useOrientation } from "@/utils/screen"
import { NeuronGroup } from "./neuron-group"
import { YPointer } from "./pointer"
import { Connections } from "./connections"
import type { LayerStateful } from "@/neuron-layers/types"

type LayerProps = LayerStateful & { allLayers: LayerStateful[] }

export const Layer = (props: LayerProps) => {
  const { layerPos, groups, prevLayer } = props
  const ref = useLayerPos(props)
  const invisible = isInvisible(props)
  useDynamicScale(ref, invisible ? 0.001 : 1)
  const [material, addBlend] = useAdditiveBlending(props.hasColorChannels) // TODO: share material
  const showConnections = !invisible && !!prevLayer && !isInvisible(prevLayer)
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

  const _xShift = useVisConfigStore((s) => s.xShift)
  const yShift = useVisConfigStore((s) => s.yShift)
  const zShift = useVisConfigStore((s) => s.zShift)

  const position = useMemo(() => {
    const xShift = orientation === "landscape" ? _xShift * 1.1 : _xShift
    return [
      visibleIdx * xShift + (visibleLayers.length - 1) * xShift * -0.5,
      visibleIdx * yShift + (visibleLayers.length - 1) * yShift * -0.5,
      visibleIdx * zShift + (visibleLayers.length - 1) * zShift * -0.5,
    ]
  }, [visibleIdx, visibleLayers.length, _xShift, yShift, zShift, orientation])
  const [ref] = useAnimatedPosition(position, 0.1)
  return ref
}

const isInvisible = (layer?: LayerStateful) =>
  useVisConfigStore
    .getState()
    .invisibleLayers.includes(layer?.tfLayer.name ?? "")

function useDynamicScale(
  ref: React.RefObject<THREE.Mesh | null>,
  scale: number = 1
) {
  const { invalidate } = useThree()
  // would use @react-spring/three, but that breaks @react-spring/web:
  // https://github.com/pmndrs/react-spring/issues/1586
  useSpring({
    scale,
    config: { duration: 150 },
    onChange: ({ value }) => {
      const val = value.scale
      ref.current?.scale.set(val, val, val)
      invalidate()
    },
  })
}

export function useAdditiveBlending(hasColorChannels: boolean) {
  const splitColors = useVisConfigStore((s) => s.splitColors)
  const active = hasColorChannels && !splitColors
  const material = useMemo(() => new THREE.MeshStandardMaterial(), [])
  useEffect(() => {
    const blending = active ? THREE.AdditiveBlending : THREE.NormalBlending
    material.blending = blending
    material.needsUpdate = true
  }, [material, active])
  return [material, active] as const
}
