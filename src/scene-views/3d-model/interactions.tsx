import { useRef, useEffect, useCallback, useMemo } from "react"
import * as THREE from "three"
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber"
import { MeshDiscardMaterial, Outlines } from "@react-three/drei"
import { useHovered, useSelected } from "@/neuron-layers/neuron-select"
import { getWorldPos, useSize } from "./utils"
import { clearStatus, isDebug, setStatus, useSceneStore } from "@/store"
import { isTouch } from "@/utils/screen"
import { HoverConnections } from "./connections"
import type { Neuron, NeuronLayer } from "@/neuron-layers"
import type { Mesh } from "three"

const LAYER_HOVER_STATUS = "layer-hover-status"

export function useLayerInteractions(layer: NeuronLayer, isActive: boolean) {
  const measureRef = useRef<THREE.Mesh>(null)
  const hoveredIdx = useSceneStore((s) => s.hoveredLayerIdx)
  const isHovered = hoveredIdx === layer.index
  const setHoveredLayerIdx = useSceneStore((s) => s.setHoveredLayerIdx)
  const setIsHovered = useCallback(
    (hovered: boolean) => setHoveredLayerIdx(hovered ? layer.index : undefined),
    [setHoveredLayerIdx, layer.index]
  )
  useEffect(() => {
    if (!isActive) return
    return () => {
      setIsHovered(false)
      clearStatus(LAYER_HOVER_STATUS)
    }
  }, [isActive, setIsHovered])
  const [size] = useSize(measureRef, 0.2)
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)

  const { layerType, tfLayer } = layer
  const name = `${layerType} (${tfLayer.outputShape.slice(1).join("x")})`
  const status = (
    <>
      <p>{name}</p>
      <p>Double click to focus</p>
    </>
  )

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.buttons) return
    document.body.style.cursor = "pointer"
    setStatus(status, undefined, { id: LAYER_HOVER_STATUS })
    if (!isTouch()) setIsHovered(true)
  }
  const onPointerLeave = () => {
    document.body.style.cursor = "default"
    clearStatus(LAYER_HOVER_STATUS)
    setIsHovered(false)
  }
  const onTap = () => {
    if (!isHovered) {
      setIsHovered(true)
      setStatus(status, undefined, { id: LAYER_HOVER_STATUS })
    } else {
      setIsHovered(false)
      clearStatus(LAYER_HOVER_STATUS)
    }
  }
  const onDoubleClick = () => setFocussedIdx(layer.index)

  const interactions = {
    onPointerOver,
    onPointerLeave,
    onClick: isTouch() ? onTap : undefined,
    onDoubleClick,
  }

  const hoverMesh = (
    <mesh {...(isActive ? interactions : {})}>
      <boxGeometry args={size} />
      <MeshDiscardMaterial />
      <Outlines
        color={"white"}
        transparent
        opacity={isHovered ? 0.2 : 0}
        // renderOrder={-1}
      />
    </mesh>
  )
  return [measureRef, hoverMesh] as const
}

export function useNeuronInteractions(
  groupedNeurons: Neuron[],
  isActive: boolean
) {
  const toggleSelected = useSceneStore((s) => s.toggleSelected)
  const toggleHovered = useSceneStore((s) => s.toggleHovered)
  const eventHandlers = useMemo(() => {
    return {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        // e.stopPropagation()
        if (!isActive) return
        if (e.buttons) return
        document.body.style.cursor = "pointer"
        toggleHovered(groupedNeurons[e.instanceId as number])
        return
      },
      onPointerOut: () => {
        if (isActive) document.body.style.cursor = "default"
        toggleHovered(null)
      },
      onClick: (e: ThreeEvent<PointerEvent>) => {
        if (!isActive) return
        const neuron = groupedNeurons[e.instanceId as number]
        if (isDebug()) console.log(neuron)
        toggleSelected(neuron)
      },
    }
  }, [isActive, groupedNeurons, toggleHovered, toggleSelected])
  return eventHandlers
}

export function HoverComponents() {
  const selected = useSelected()
  const hovered = useHovered()
  /* const hasFocussedLayer = useHasFocussedLayer() */
  return (
    <>
      <HoverConnections hovered={hovered} />
      <Highlighted neuron={selected} thick />
      <Highlighted neuron={hovered} />
    </>
  )
}

interface HighlightedProps {
  neuron?: Neuron
  thick?: boolean
}

const COLOR = "rgb(150, 156, 171)"

export function Highlighted({ neuron, thick }: HighlightedProps) {
  const ref = useRef<Mesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(invalidate, [neuron, invalidate])
  useFrame(() => {
    if (!neuron || !ref.current) return
    const pos = getWorldPos(neuron)
    if (!pos) return
    ref.current!.position.copy(pos)
  })
  if (!neuron) return null
  const { geometry } = neuron.layer.meshParams
  return (
    <mesh ref={ref} scale={thick ? 1.15 : 1.1}>
      <primitive object={geometry} attach={"geometry"} />
      <MeshDiscardMaterial />
      <Outlines color={COLOR} />
    </mesh>
  )
}
