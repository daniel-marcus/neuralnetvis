import { useCallback, useEffect, useLayoutEffect, useMemo } from "react"
import * as THREE from "three"
import { useLayerActivations } from "@/model/activations"
import { useLayerInteractions } from "./interactions"
import type { NeuronLayer } from "@/neuron-layers/types"

const GROUP_GAP = 1 // texture pixel between groups

export function TexturedLayer(props: NeuronLayer) {
  const texture = useActivationTexture(props)
  const geometry = useCachedGeometry(texture)
  const [ref, hoverMesh] = useLayerInteractions(props, true)
  return (
    <group>
      <mesh ref={ref}>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial map={texture} transparent />
      </mesh>
      {hoverMesh}
    </group>
  )
}

function useActivationTexture(layer: NeuronLayer) {
  const layerActivations = useLayerActivations(layer.index)
  const [, height, width, channels] = layer.tfLayer.outputShape as number[]

  const texture = useMemo(() => {
    const gridCols = Math.ceil(Math.sqrt(channels))
    const gridRows = Math.ceil(channels / gridCols)

    const texWidth = gridCols * width + (gridCols - 1) * GROUP_GAP
    const texHeight = gridRows * height + (gridRows - 1) * GROUP_GAP

    const data = new Uint8Array(texWidth * texHeight * 4).fill(0)
    const args = [data, texWidth, texHeight, THREE.RGBAFormat] as const
    const texture = new THREE.DataTexture(...args)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [height, width, channels])

  useEffect(() => {
    return () => texture.dispose()
  }, [texture])

  useLayoutEffect(() => {
    const gridCols = Math.ceil(Math.sqrt(channels))

    const { width: texWidth } = texture.image
    const data32 = new Uint32Array(texture.image.data.buffer)

    for (let channel = 0; channel < channels; channel++) {
      const gridX = channel % gridCols
      const gridY = (channel / gridCols) | 0 // like Math.floor but faster

      const blockX = gridX * (width + GROUP_GAP)
      const blockY = gridY * (height + GROUP_GAP)

      for (let h = 0; h < height; h++) {
        const y = blockY + h
        const rowOffset = y * texWidth

        for (let w = 0; w < width; w++) {
          const x = blockX + w
          const offset = rowOffset + x

          const idx = h * (width * channels) + w * channels + channel
          const rgba = layerActivations?.colors[idx]?.rgba ?? [0, 0, 0, 0]
          const [r, g, b, a] = rgba
          const packed = (a << 24) | (b << 16) | (g << 8) | r
          data32[offset] = packed // pack rgba into 32-bit int -> 1 single write instead of 4
          // data.set(rgba, offset * 4) // 4 writes
        }
      }
    }

    texture.needsUpdate = true
  }, [layerActivations, height, width, channels, texture])

  return texture
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

      const BOX_SIZE_THREE = 0.2 // TODO: adjust w/ neuron box size?
      const size = [1, height, width].map((v) => v * BOX_SIZE_THREE)
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
