import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { memo, type RefObject } from "react"
import * as THREE from "three/webgpu"
import { uniform } from "three/tsl"
import { useLayerActivations } from "@/model/activations"
import { useNeuronSpacing } from "./layer-instanced"
import { getMaxAbs } from "@/data/utils"
import { getTextureMaterial } from "./materials"
import type { NeuronLayer } from "@/neuron-layers/types"

const CELL_GAP = 1 // texture pixel between cells

export interface UserDataTextured {
  // dataTexture: THREE.DataTexture
  activations: THREE.StorageBufferAttribute
  maxAbs: THREE.TSL.ShaderNodeObject<THREE.UniformNode<number>>
  mapTexture: THREE.DataTexture
}

export const TexturedLayer = memo(function TexturedLayer(props: NeuronLayer) {
  const { activationsBuffer } = props
  const meshRef = useRef<THREE.Mesh>(null)
  const [texture, material, mapTexture] = useActivationTexture(props, meshRef)
  const { size, spacedSize } = useNeuronSpacing(props.meshParams)
  const geometry = useCachedGeometry(texture)
  const userData: UserDataTextured = useMemo(() => {
    return {
      activations: activationsBuffer,
      maxAbs: uniform(1.0), // TODO
      mapTexture,
    }
  }, [activationsBuffer, mapTexture])
  return (
    <mesh
      ref={meshRef}
      scale={[size, spacedSize, spacedSize]}
      userData={userData}
    >
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </mesh>
  )
})

function useActivationTexture(
  layer: NeuronLayer,
  meshRef: RefObject<THREE.Mesh | null>
) {
  const layerActivations = useLayerActivations(layer.index)
  const [, height, width, channels] = layer.tfLayer.outputShape as number[]

  const texture = useMemo(() => {
    const gridCols = Math.ceil(Math.sqrt(channels))
    const gridRows = Math.ceil(channels / gridCols)

    const texWidth = gridCols * width + (gridCols - 1) * CELL_GAP
    const texHeight = gridRows * height + (gridRows - 1) * CELL_GAP

    // use -999.0 as marker for empty (transparent) pixels
    const data = new Float32Array(texWidth * texHeight * 4).fill(-999.0)

    const texture = new THREE.DataTexture(
      data,
      texWidth,
      texHeight,
      THREE.RedFormat,
      THREE.FloatType
    )
    // texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [height, width, channels])

  const material = useMemo(() => getTextureMaterial(), [])
  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  const pixelMap = useMemo(() => {
    // map every activation index to the corresponding offset in the texture buffer
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
  }, [width, height, channels, texture.image.width])

  const mapTexture = useMemo(() => {
    // reverse of pixelMap: maps texture pixel to activation index
    const mapTexture = texture.clone()
    const data = mapTexture.image.data as Float32Array
    pixelMap.forEach((texIdx, activationIdx) => {
      data[texIdx] = activationIdx
    })
    return mapTexture
  }, [texture, pixelMap])

  useLayoutEffect(() => {
    if (!meshRef.current || !layerActivations) return
    // update pixel colors in the texture
    // layerActivations only used as update trigger here
    const data = texture.image.data as Float32Array
    const { activations } = layer

    for (let i = 0; i < activations.length; i++) {
      data[pixelMap[i]] = activations[i]
    }

    const userData = meshRef.current.userData as UserDataTextured
    userData.maxAbs.value = getMaxAbs(activations)
    texture.needsUpdate = true
  }, [texture, pixelMap, layerActivations, layer, meshRef])

  return [texture, material, mapTexture] as const
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
