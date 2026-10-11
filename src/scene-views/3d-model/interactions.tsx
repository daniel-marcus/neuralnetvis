import { useRef, useEffect, useCallback, useMemo, type RefObject } from "react"
import * as THREE from "three/webgpu"
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { useHovered, useSelected } from "@/neuron-layers/neurons"
import { getNeuronIdxAtRay, getWorldTransform, useSize } from "./utils"
import { setStatus, clearStatus, useGlobalStore } from "@/store"
import { getScene, useSceneStore, useHasFocussed } from "@/store"
import { isTouch } from "@/utils/screen"
import { HoverConnections, InputRegions } from "./connections"
import { getNid } from "@/neuron-layers/helpers"
import type { Neuron, NeuronLayer, Nid } from "@/neuron-layers"

const LAYER_HOVER_STATUS = "layer-hover-status"

const layerHoverGeometry = new THREE.BoxGeometry(1, 1, 1)
const layerHoverEdges = new THREE.EdgesGeometry(layerHoverGeometry)
const noRaycast = () => null

export function LayerInteractions(
  props: NeuronLayer & { measureRef: RefObject<THREE.Mesh | null> },
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
    [setHoveredLayerIdx, props.index],
  )
  useEffect(() => {
    if (!isActive) return
    return () => {
      setIsHovered(false)
      clearStatus(LAYER_HOVER_STATUS)
    }
  }, [isActive, setIsHovered])
  const size = useSize(props.measureRef, 0.2)
  const setFocussedIdx = useSceneStore((s) => s.setFocussedLayerIdx)
  // neurons of the hovered layer can be hovered & selected as well (no hover on touch devices)
  const setHoveredNid = useSceneStore((s) => s.setHoveredNid)
  const setSelectedNid = useSceneStore((s) => s.setSelectedNid)
  const setHoveredNeuron = (nid?: Nid) => {
    if (getScene().getState().hoveredNid !== nid) setHoveredNid(nid)
  }
  // this layer catches the events, but the neurons behind are included in the intersections
  const getNeuronNid = (e: ThreeEvent<MouseEvent>) => {
    if (!props.meshRefs.some((r) => r.current?.visible)) {
      // textured layer: no instances to hit
      const neuronIdx = getNeuronIdxAtRay(props, e.ray)
      return typeof neuronIdx === "number" ? getNid(props.index, neuronIdx) : undefined
    }
    const hit = e.intersections.find((i) => props.meshRefs.some((r) => r.current === i.object))
    if (typeof hit?.instanceId !== "number") return undefined
    const channelIdx = props.meshRefs.findIndex((r) => r.current === hit.object)
    return getNid(props.index, hit.instanceId + channelIdx) // as in useNeuronInteractions
  }

  const { layerType, tfLayer } = props
  const name = `${layerType} (${tfLayer.outputShape.slice(1).join("x")})`
  const status = (
    <>
      <p>{name}</p>
      <p className="text-muted">Double click to focus</p>
    </>
  )

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.buttons) return
    document.body.style.cursor = "pointer"
    setStatus(status, undefined, { id: LAYER_HOVER_STATUS })
    if (!isTouch()) setIsHovered(true)
  }
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    if (e.buttons) return
    setHoveredNeuron(getNeuronNid(e))
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!isSingleClick(e)) return
    const nid = getNeuronNid(e)
    if (nid) setSelectedNid(nid)
  }
  const onPointerLeave = () => {
    document.body.style.cursor = "default"
    clearStatus(LAYER_HOVER_STATUS)
    setIsHovered(false)
    setHoveredNeuron(undefined)
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
    onPointerMove: isTouch() ? undefined : onPointerMove,
    onPointerLeave,
    onClick: isTouch() ? onTap : onClick,
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
    <mesh {...(isActive ? interactions : {})} scale={size} renderOrder={1}>
      <primitive object={layerHoverGeometry} attach={"geometry"} />
      <meshBasicMaterial
        color="white"
        transparent
        opacity={isHovered ? 0.01 : 0}
        depthWrite={false}
        // avoid z-fighting with the layer (low depth precision for distant layers)
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
      />
      {/* the fill is barely visible against the (transparent) background */}
      <lineSegments visible={isHovered} raycast={noRaycast} renderOrder={1}>
        <primitive object={layerHoverEdges} attach={"geometry"} />
        <lineBasicMaterial color="white" transparent opacity={0.25} depthWrite={false} />
      </lineSegments>
    </mesh>
  )
}

// not the end of a drag (camera controls) and not the 2nd click of a double click (focusses the layer)
function isSingleClick(e: ThreeEvent<MouseEvent>) {
  return e.delta <= 2 && e.nativeEvent.detail <= 1
}

export function useNeuronInteractions(layerIdx: number, channelIdx = 0) {
  const sceneActive = useSceneStore((s) => s.isActive)
  const visIsLocked = useSceneStore((s) => s.vis.isLocked)
  const isActive = sceneActive && !visIsLocked
  const setSelectedNid = useSceneStore((s) => s.setSelectedNid)
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
      onClick: (e: ThreeEvent<MouseEvent>) => {
        // other layers: see LayerInteractions
        const focussedIdx = getScene().getState().focussedLayerIdx
        if (layerIdx !== focussedIdx || !isSingleClick(e)) return
        const neuronIdx = (e.instanceId as number) + channelIdx
        const nid = getNid(layerIdx, neuronIdx)
        setSelectedNid(nid)
      },
    }
  }, [layerIdx, channelIdx, toggleHovered, setSelectedNid])
  return isActive ? eventHandlers : undefined
}

export function HoverComponents() {
  const isActive = useSceneStore((s) => s.isActive)
  const selected = useSelected()
  const hovered = useHovered()
  const setSelectedNid = useSceneStore((s) => s.setSelectedNid)
  const getThreeState = useThree((s) => s.get)
  if (!isActive) return null
  // deselect on click on empty space
  const onPointerMissed = (e: MouseEvent) => {
    const { internal, events, scene, gl } = getThreeState()
    if (internal.initialHits.length) return // is also called for clicks on other objects
    const canvas = scene.userData.canvasTarget?.domElement ?? gl.domElement
    const isCanvas = e.target === canvas || e.target === events.connected
    if (isCanvas) setSelectedNid(undefined) // not for ui elements above the canvas
  }
  return (
    <>
      <group onPointerMissed={onPointerMissed} />
      <HoverConnections neuron={hovered ?? selected} />
      <InputRegions neuron={hovered ?? selected} />
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

function Highlighted({ neuron, thick }: HighlightedProps) {
  const ref = useRef<THREE.Mesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(invalidate, [neuron, invalidate])
  const factor = thick ? 1.15 : 1.1
  useFrame(() => {
    if (!neuron || !ref.current) return
    const transform = getWorldTransform(neuron)
    if (!transform) return
    ref.current.position.copy(transform.position)
    ref.current.scale.copy(transform.scale).multiplyScalar(factor)
  })
  if (!neuron) return null
  const { geometry } = neuron.layer.meshParams
  /*
  
      <MeshDiscardMaterial />
      <Outlines color={COLOR} />
  
  */
  return (
    <mesh ref={ref}>
      <primitive object={geometry} attach={"geometry"} />
      <meshBasicMaterial color="white" transparent opacity={0.02} depthWrite={false} />
    </mesh>
  )
}
