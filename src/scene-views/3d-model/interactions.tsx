import { useRef, useEffect, useCallback, useMemo, RefObject } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { useHovered, useSelected } from "@/neuron-layers/neurons"
import { getWorldPos, useSize } from "./utils"
import { setStatus, clearStatus, useGlobalStore } from "@/store"
import { getScene, useSceneStore, useHasFocussed } from "@/store"
import { isTouch } from "@/utils/screen"
import { HoverConnections } from "./connections"
import { getNid } from "@/neuron-layers/neurons"
import type { Neuron, NeuronLayer } from "@/neuron-layers"

const LAYER_HOVER_STATUS = "layer-hover-status"

const layerHoverGeometry = new THREE.BoxGeometry(1, 1, 1)

export function LayerInteractions(
  props: NeuronLayer & { measureRef: RefObject<THREE.Mesh | null> }
) {
  const hasFocussed = useHasFocussed()
  const sceneActive = useSceneStore((s) => s.isActive)
  const visIsLocked = useSceneStore((s) => s.vis.isLocked)
  const isDebug = useGlobalStore((s) => s.isDebug)
  const isActive = sceneActive && !hasFocussed && !visIsLocked && !isDebug
  const hoveredIdx = useSceneStore((s) => s.hoveredLayerIdx)
  const isHovered = hoveredIdx === props.index
  const setHoveredLayerIdx = useSceneStore((s) => s.setHoveredLayerIdx)
  const setIsHovered = useCallback(
    (hovered: boolean) => setHoveredLayerIdx(hovered ? props.index : undefined),
    [setHoveredLayerIdx, props.index]
  )
  useEffect(() => {
    if (!isActive) return
    return () => {
      setIsHovered(false)
      clearStatus(LAYER_HOVER_STATUS)
    }
  }, [isActive, setIsHovered])
  const [size] = useSize(props.measureRef, 0.2)
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)

  const { layerType, tfLayer } = props
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
  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    setFocussedIdx(props.index)
  }

  const interactions = {
    onPointerOver,
    onPointerLeave,
    onClick: isTouch() ? onTap : undefined,
    onDoubleClick,
  }
  /*
      <Outlines
        color={"white"} // <MeshDiscardMaterial />
        transparent
        opacity={isHovered ? 0.2 : 0}
        // renderOrder={-1}
      />
  
  */
  return (
    <mesh {...(isActive ? interactions : {})} scale={size} renderOrder={-1}>
      <primitive object={layerHoverGeometry} attach={"geometry"} />
      <meshBasicMaterial
        color="white"
        transparent
        opacity={isHovered ? 0.02 : 0}
        depthWrite={false}
      />
    </mesh>
  )
}

export function useNeuronInteractions(layerIdx: number, channelIdx = 0) {
  const sceneActive = useSceneStore((s) => s.isActive)
  const visIsLocked = useSceneStore((s) => s.vis.isLocked)
  const isActive = sceneActive && !visIsLocked
  const toggleSelected = useSceneStore((s) => s.toggleSelected)
  const toggleHovered = useSceneStore((s) => s.toggleHovered)
  const eventHandlers = useMemo(() => {
    return {
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        // e.stopPropagation()
        if (e.buttons) return
        document.body.style.cursor = "pointer"
        const neuronIdx = (e.instanceId as number) + channelIdx
        const nid = getNid(layerIdx, neuronIdx)
        toggleHovered(nid)
        return
      },
      onPointerOut: () => {
        document.body.style.cursor = "default"
        toggleHovered(undefined)
      },
      onClick: (e: ThreeEvent<PointerEvent>) => {
        const focussedIdx = getScene().getState().focussedLayerIdx
        if (layerIdx !== focussedIdx) return
        const neuronIdx = (e.instanceId as number) + channelIdx
        const nid = getNid(layerIdx, neuronIdx)
        toggleSelected(nid)
      },
    }
  }, [layerIdx, channelIdx, toggleHovered, toggleSelected])
  return isActive ? eventHandlers : undefined
}

export function HoverComponents() {
  const isActive = useSceneStore((s) => s.isActive)
  const selected = useSelected()
  const hovered = useHovered()
  if (!isActive) return null
  // <HoverConnections hovered={hovered} />
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

// const COLOR = "rgb(150, 156, 171)"

export function Highlighted({ neuron, thick }: HighlightedProps) {
  const ref = useRef<THREE.Mesh>(null)
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
  /* 
  
      <MeshDiscardMaterial />
      <Outlines color={COLOR} />
  
  */
  return (
    <mesh ref={ref} scale={thick ? 1.15 : 1.1}>
      <primitive object={geometry} attach={"geometry"} />
      <meshBasicMaterial
        color="white"
        transparent
        opacity={0.02}
        depthWrite={false}
      />
    </mesh>
  )
}
