import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { ThreeEvent } from "@react-three/fiber"
import { MeshDiscardMaterial, Outlines } from "@react-three/drei"
import {
  useGlobalStore,
  isDebug,
  useSceneStore,
  setStatus,
  clearStatus,
  useHasFocussedLayer,
} from "@/store"
import { useLayerActivations } from "@/model/activations"
import { getGridSize, getNeuronPos, MeshParams } from "@/neuron-layers/layout"
import { useAnimatedPosition, useSize, Pos } from "@/scene-views/3d-model/utils"
import { isTouch } from "@/utils/screen"
import { NeuronLabels } from "./label"
import type {
  Neuron,
  MeshRef,
  NeuronGroupProps,
  LayerStateless,
} from "@/neuron-layers/types"
import type { LayerActivations } from "@/model"

type InstancedLayerProps = NeuronGroupProps & {
  invisible?: boolean
}

export const InstancedLayer = (props: InstancedLayerProps) => {
  const { meshParams, group, invisible, hasColorChannels } = props
  const material = useMaterial(hasColorChannels)
  const groupRef = useGroupPosition(props)
  const positions = useNeuronPositions(props)

  const activations = useLayerActivations(props.index)
  useColors(group.meshRef, group.neurons, hasColorChannels, activations)

  const isActive = useSceneStore((s) => s.isActive)
  const hasFocussed = useHasFocussedLayer()
  const [measureRef, hoverMesh] = useLayerInteractions(
    props,
    isActive && !hasFocussed,
    positions
  )
  const eventHandlers = useNeuronInteractions(
    group.neurons,
    isActive && hasFocussed && !invisible
  )

  const renderOrder =
    props.layerPos === "input"
      ? 0 - group.index // reversed order for color blending
      : undefined

  return (
    <group ref={groupRef}>
      <group ref={measureRef}>
        <instancedMesh
          ref={group.meshRef}
          name={`layer_${props.index}_group_${group.index}`}
          args={[, , group.neurons.length]}
          renderOrder={renderOrder}
          visible={!invisible}
          {...eventHandlers}
        >
          <primitive object={meshParams.geometry} attach={"geometry"} />
          <primitive object={material} attach={"material"} />
        </instancedMesh>
      </group>
      {hoverMesh}
      {props.hasLabels &&
        group.neurons.map((n, i) => (
          <NeuronLabels key={n.nid} neuron={n} position={positions[i]} />
        ))}
    </group>
  )
}

const standardMaterial = new THREE.MeshStandardMaterial()
const blendingMaterial = new THREE.MeshBasicMaterial({
  blending: THREE.AdditiveBlending,
})

function useMaterial(hasColorChannels: boolean) {
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  return hasColorChannels && !splitColors ? blendingMaterial : standardMaterial
}

export function useNeuronSpacing({ geometry, spacingFactor }: MeshParams) {
  const neuronSpacing = useSceneStore((s) => s.vis.neuronSpacing)
  const p = geometry.parameters as { width?: number; radius?: number }
  const size = p.width ?? p.radius ?? 1
  const factor = spacingFactor ?? 1
  const spacing = size * neuronSpacing * factor
  return spacing
}

export function useGroupPosition(props: NeuronGroupProps) {
  const { group, layerPos, meshParams, hasColorChannels } = props
  const groupIndex = group.index
  const groupCount = props.groups.length
  const spacing = useNeuronSpacing(meshParams)
  const splitColors = useSceneStore((s) => s.vis.splitColors)
  const [, height, width = 1] = props.tfLayer.outputShape as number[]
  const position = useMemo(() => {
    const GRID_SPACING = 0.6
    const [gHeight] = getGridSize(height, width, spacing, GRID_SPACING)

    const SPLIT_COLORS_OFFSET = 0.05 // to avoid z-fighting
    return layerPos === "input" && hasColorChannels
      ? splitColors
        ? [
            -groupIndex * SPLIT_COLORS_OFFSET,
            -groupIndex * gHeight + (groupCount - 1) * gHeight * 0.5,
            groupIndex * SPLIT_COLORS_OFFSET,
          ] // spread on y-axis
        : [
            groupIndex * SPLIT_COLORS_OFFSET,
            -groupIndex * SPLIT_COLORS_OFFSET,
            -groupIndex * SPLIT_COLORS_OFFSET,
          ]
      : [0, 0, 0]
  }, [
    groupIndex,
    groupCount,
    layerPos,
    spacing,
    splitColors,
    height,
    width,
    hasColorChannels,
  ])
  const [groupRef] = useAnimatedPosition(position, 0.1)
  return groupRef
}

function useNeuronPositions(props: NeuronGroupProps) {
  const { layerPos, group, meshParams, tfLayer, hasColorChannels } = props
  const spacing = useNeuronSpacing(meshParams)
  const [, height, width = 1, _channels = 1] = tfLayer.outputShape as number[]
  const tempObj = useMemo(() => new THREE.Object3D(), [])

  const channels = hasColorChannels ? 1 : _channels // for color channels: channel separation is done on layer level

  const positions = useMemo(() => {
    return Array.from({ length: height * width * channels }, (_, i) =>
      getNeuronPos(i, layerPos, height, width, channels, spacing)
    )
  }, [layerPos, spacing, height, width, channels])

  // has to be useLayoutEffect, otherwise raycasting probably won't work
  useLayoutEffect(() => {
    if (!group.meshRef.current) return
    if (isDebug()) console.log("upd pos")
    for (const [i, position] of positions.entries()) {
      tempObj.position.set(...position)
      tempObj.updateMatrix()
      group.meshRef.current?.setMatrixAt(i, tempObj.matrix)
    }
    group.meshRef.current.instanceMatrix.needsUpdate = true
  }, [group.meshRef, tempObj, positions])

  return positions
}

function useColors(
  meshRef: MeshRef,
  neurons: Neuron[],
  hasColorChannels: boolean,
  activations?: LayerActivations
) {
  useLayoutEffect(() => {
    if (!meshRef.current) return

    const allColors = activations?.colors ?? []
    // if (isDebug()) console.log("upd colors")
    if (!meshRef.current.instanceColor) {
      const newArr = new Float32Array(neurons.length * 3).fill(0)
      const newAttr = new THREE.InstancedBufferAttribute(newArr, 3)
      meshRef.current.instanceColor = newAttr
    }
    for (const [i, n] of neurons.entries()) {
      const color = allColors[n.index]
      // if (n.color) meshRef.current.setColorAt(i, n.color)
      if (color) {
        meshRef.current.instanceColor.array[i * 3] = color.rgb[0]
        meshRef.current.instanceColor.array[i * 3 + 1] = color.rgb[1]
        meshRef.current.instanceColor.array[i * 3 + 2] = color.rgb[2]
      }
    }
    meshRef.current.instanceColor.needsUpdate = true
  }, [meshRef, neurons, activations, hasColorChannels])
}

function useNeuronInteractions(groupedNeurons: Neuron[], isActive: boolean) {
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
        if (useGlobalStore.getState().isDebug) console.log(neuron)
        toggleSelected(neuron)
      },
    }
  }, [isActive, groupedNeurons, toggleHovered, toggleSelected])
  return eventHandlers
}

const LAYER_HOVER_STATUS = "layer-hover-status"

export function useLayerInteractions(
  layer: LayerStateless,
  isActive: boolean,
  updTrigger?: Pos[] | number // as update trigger for useSize hook
) {
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
  const [size] = useSize(measureRef, 0.2, updTrigger)
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
