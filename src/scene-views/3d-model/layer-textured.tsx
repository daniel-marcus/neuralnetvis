import { useCallback, useEffect, useMemo, memo } from "react"
import * as THREE from "three/webgpu"
import { useNeuronSpacing } from "./layer-instanced"
import { getTextureMaterial } from "./materials"
import { useLayerActivations } from "@/model/activations"
import { useIsWebGPU } from "@/utils/webgpu"
import type { NeuronLayer } from "@/neuron-layers/types"

const CELL_GAP = 1 // texture pixel between cells

export interface UserDataTextured {
  activations: THREE.StorageBufferAttribute
  actTexture: THREE.DataTexture // for WebGL fallback
}

type TexturedLayerProps = NeuronLayer & {
  visible: boolean
  channelIdx: number // for layers with color channels
}

export const TexturedLayer = memo(function TexturedLayer(
  props: TexturedLayerProps
) {
  const { visible, hasColorChannels, channelIdx = 0 } = props
  const [texture, material, userData] = useActivationTexture(props)
  const { size, spacedSize } = useNeuronSpacing(props.meshParams)
  const geometry = useCachedGeometry(texture)
  const renderOrder = hasColorChannels ? 0 - channelIdx : undefined // reversed render order for color blending
  return (
    <mesh
      scale={[size, spacedSize, spacedSize]}
      userData={userData}
      visible={visible}
      renderOrder={renderOrder}
    >
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </mesh>
  )
})

function useActivationTexture(layer: TexturedLayerProps) {
  const { hasColorChannels, channelIdx = 0 } = layer
  const [, height, width, _channels] = layer.tfLayer.outputShape as number[]

  const channels = hasColorChannels ? 1 : _channels // for color channels: channel separation is done on layer level

  const isWebGPU = useIsWebGPU()

  const texture = useMemo(() => {
    const gridCols = Math.ceil(Math.sqrt(channels))
    const gridRows = Math.ceil(channels / gridCols)

    const texWidth = gridCols * width + (gridCols - 1) * CELL_GAP
    const texHeight = gridRows * height + (gridRows - 1) * CELL_GAP

    const data = isWebGPU
      ? null // in webgpu we do everything in the shader, so data will be null here
      : new Float32Array(texWidth * texHeight * 4).fill(-999.0) // use -999.0 as marker for empty (transparent) pixels

    const texture = new THREE.DataTexture(
      data,
      texWidth,
      texHeight,
      THREE.RedFormat,
      THREE.FloatType
    )
    // texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [height, width, channels, isWebGPU])

  const material = useMemo(
    () =>
      getTextureMaterial(hasColorChannels, channelIdx, height, width, channels),
    [hasColorChannels, channelIdx, height, width, channels]
  )
  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  const pixelMap = useMemo(() => {
    if (isWebGPU) return null
    // for WebGL fallback: map every activation index to the corresponding offset in the texture buffer
    const map = new Uint32Array(width * height * channels)

    const gridCols = Math.ceil(Math.sqrt(channels))
    const texWidth = texture.image.width

    for (let channel = 0; channel < channels; channel++) {
      const gridX = channel % gridCols
      const gridY = Math.floor(channel / gridCols)

      const blockX = gridX * (width + CELL_GAP)
      const blockY = gridY * (height + CELL_GAP)

      for (let h = 0; h < height; h++) {
        const y = blockY + h
        const rowOffset = y * texWidth

        for (let w = 0; w < width; w++) {
          const x = blockX + w
          const offset = rowOffset + x
          const idx = h * (width * channels) + w * channels + channel
          map[idx] = offset
        }
      }
    }
    return map
  }, [width, height, channels, texture.image.width, isWebGPU])

  const userData: UserDataTextured = useMemo(
    () => ({
      activations: layer.activationsBuffer,
      actTexture: texture,
    }),
    [layer.activationsBuffer, texture]
  )

  const layerActivations = useLayerActivations(layer.index)
  useEffect(() => {
    // WebGL fallback: update texture on CPU
    const data = texture.image.data as Float32Array | null
    const _act = layerActivations?.normalizedActivations
    if (!_act || !data || !pixelMap) return // no data or pixel map in WebGPU

    let act = _act
    if (hasColorChannels) {
      // for color channels, use a view with offset for the current channel
      const channelUnits = _act.length / 3
      const offset = channelIdx * channelUnits
      act = new Float32Array(_act.buffer, offset * 4, channelUnits)
    }

    for (let i = 0; i < act.length; i++) {
      data[pixelMap[i]] = act[i]
    }
    texture.needsUpdate = true
  }, [texture, pixelMap, layerActivations, hasColorChannels, channelIdx])

  return [texture, material, userData] as const
}

function updateUvMapping(
  geometry: THREE.BufferGeometry,
  width: number,
  height: number
) {
  // https://discoverthreejs.com/book/first-steps/textures-intro/
  const first = (base: number) => 1 / base
  const last = (base: number) => (base - 1) / base

  const uvAttr = geometry.attributes.uv
  type UV = [number, number]
  // lt, rt, lb, rb
  const uvSet = (uv1: UV, uv2: UV, uv3: UV, uv4: UV, offset: number) =>
    uvAttr.array.set([...uv1, ...uv2, ...uv3, ...uv4], offset)

  // front means face left (-x) here
  const o = { BACK: 0, FRONT: 8, TOP: 16, BOTTOM: 24, RIGHT: 32, LEFT: 40 }

  uvSet([0, 0], [1, 0], [0, 1], [1, 1], o.FRONT) // upside down bc/ textures start at bottom left
  uvSet([1, 0], [0, 0], [1, 1], [0, 1], o.BACK)
  uvSet([0, first(height)], [0, 0], [1, first(height)], [1, 0], o.TOP)
  uvSet([1, 1], [1, last(height)], [0, 1], [0, last(height)], o.BOTTOM)
  uvSet([last(width), 0], [1, 0], [last(width), 1], [1, 1], o.RIGHT)
  uvSet([0, 0], [first(width), 0], [0, 1], [first(width), 1], o.LEFT)

  uvAttr.needsUpdate = true
}

const geometryCache = new Map<string, THREE.BoxGeometry>()

// reuse geometries for same size
function useCachedGeometry(texture: THREE.DataTexture) {
  const { width, height } = texture.image
  const id = `${width}-${height}`

  const getGeometry = useCallback(
    (id: string): THREE.BoxGeometry => {
      if (geometryCache.has(id)) return geometryCache.get(id)!

      const size = [1, height, width]
      const geom = new THREE.BoxGeometry(...size)
      updateUvMapping(geom, width, height)

      geometryCache.set(id, geom)
      return geom
    },
    [width, height]
  )

  const geometry = useMemo(() => getGeometry(id), [id, getGeometry])
  return geometry
}

/*
neuron interactions: 

      onPointerMove={() => {
        const intersectionPoint = event.point

        const localPoint = new THREE.Vector3()
        ref.current?.worldToLocal(localPoint.copy(intersectionPoint))

        const geometry = ref.current?.geometry as THREE.BufferGeometry
        const boundingBox = new THREE.Box3().setFromBufferAttribute(
          geometry.attributes.position as THREE.BufferAttribute
        )
        const height = boundingBox.max.y - boundingBox.min.y
        const depth = boundingBox.max.z - boundingBox.min.z

        const percentY = (localPoint.y - boundingBox.min.y) / height
        const percentZ = (localPoint.z - boundingBox.min.z) / depth

        const row = Math.floor((1 - percentY) * width)
        const col = Math.floor(percentZ * width)

        const idx = row * width + col

        const neuron = group.neurons[idx]
        setHovered(neuron, intersectionPoint)
      }}
      onPointerOut={() => {
        setHovered(null)
      }}

*/
