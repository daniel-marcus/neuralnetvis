import { useCallback, useMemo, useRef } from "react"
import * as THREE from "three"
import type { LayerStateless } from "@/neuron-layers/types"
import { useLayerInteractions } from "./layer-instanced"
import { LayerActivations } from "@/model"
import { useLayerActivations } from "@/model/activations"

const BOX_SIZE = 1 // including BOX_GAP
const BOX_GAP = 0
const GROUP_GAP = 1

export function TexturedLayer(props: LayerStateless) {
  const [texture, heightBoxes, widthBoxes] = useActivationTexture(props)
  const geometry = useCachedGeometry(heightBoxes, widthBoxes)
  const [ref, hoverMesh] = useLayerInteractions(props, true, heightBoxes)
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

function useActivationTexture(layer: LayerStateless) {
  const layerActivations = useLayerActivations(layer.index)
  const [, height, width, channels] = layer.tfLayer.outputShape as number[]
  return useMemo(
    () => generateActivationTexture(layerActivations, height, width, channels),
    [layerActivations, height, width, channels]
  )
}

function generateActivationTexture(
  layerActivations: LayerActivations | undefined,
  height: number,
  width = 1,
  channels = 1
) {
  // Calculate grid dimensions
  const gridCols = Math.ceil(Math.sqrt(channels))
  const gridRows = Math.ceil(channels / gridCols)

  // Calculate per-channel dimensions including internal gaps
  const channelWidth = width * BOX_SIZE - BOX_GAP
  const channelHeight = height * BOX_SIZE - BOX_GAP

  // Calculate total texture size with inter-channel gaps
  const totalWidth = gridCols * channelWidth + (gridCols - 1) * GROUP_GAP
  const totalHeight = gridRows * channelHeight + (gridRows - 1) * GROUP_GAP
  // const sideSize = Math.max(totalWidth, totalHeight)

  // Create RGBA buffer (initialize with black transparent)
  const data = new Uint8Array(totalWidth * totalHeight * 4).fill(0)

  // Populate texture data
  for (let channel = 0; channel < channels; channel++) {
    const gridX = channel % gridCols
    const gridY = Math.floor(channel / gridCols)

    // Calculate channel block position
    const blockX = gridX * (channelWidth + GROUP_GAP)
    const blockY = gridY * (channelHeight + GROUP_GAP)

    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        // Get activation value (HWC order)
        const idx = h * (width * channels) + w * channels + channel

        const color = layerActivations?.colors[idx]

        // Get color and calculate pixel positions
        const [r, g, b] = color?.rgbArr ?? [0, 0, 0]
        const squareX = w * BOX_SIZE // 4px + 1px gap
        const squareY = h * BOX_SIZE

        // Draw colored square
        for (let dy = 0; dy < BOX_SIZE - BOX_GAP; dy++) {
          for (let dx = 0; dx < BOX_SIZE - BOX_GAP; dx++) {
            const x = blockX + squareX + dx
            const y = blockY + squareY + dy

            if (x >= totalWidth || y >= totalHeight) continue

            const flippedY = totalHeight - 1 - y // bc/ three.js texture pixels start bottom-left
            const dataIndex = (flippedY * totalWidth + x) * 4
            data[dataIndex] = r // Red
            data[dataIndex + 1] = g // Green
            data[dataIndex + 2] = b // Blue
            data[dataIndex + 3] = 255 // Alpha
          }
        }
      }
    }
  }

  // Create and return texture
  const texture = new THREE.DataTexture(
    data,
    totalWidth,
    totalHeight,
    THREE.RGBAFormat
  )
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true

  const heightBoxes = Math.ceil(totalHeight / BOX_SIZE)
  const widthBoxes = Math.ceil(totalWidth / BOX_SIZE)

  return [texture, heightBoxes, widthBoxes] as const
}

function updateUvMapping(
  geometry: THREE.BufferGeometry,
  heightBoxes: number,
  widthBoxes: number
) {
  // https://discoverthreejs.com/book/first-steps/textures-intro/
  const box = BOX_SIZE - BOX_GAP
  const textureHeight = heightBoxes * BOX_SIZE - BOX_GAP
  const textureWidth = widthBoxes * BOX_SIZE - BOX_GAP

  const first = (base: number) => box / base
  const last = (base: number) => (base - box) / base
  // Access the UV attribute
  const uvAttribute = geometry.attributes.uv
  const uvArray = uvAttribute.array

  // back (mirror)
  uvArray.set(
    [
      ...[1, 1],
      ...[0, 1], //
      ...[1, 0],
      ...[0, 0],
    ],
    0
  )

  // top
  uvArray.set(
    [
      ...[0, 1],
      ...[0, last(textureHeight)],
      ...[1, 1],
      ...[1, last(textureHeight)], //
    ],
    16
  )

  // bottom
  uvArray.set(
    [
      ...[1, first(textureHeight)],
      ...[1, 0],
      ...[0, first(textureHeight)],
      ...[0, 0], //
    ],
    24
  )

  // right side
  uvArray.set(
    [
      ...[last(textureWidth), 1],
      ...[1, 1], //
      ...[last(textureWidth), 0],
      ...[1, 0],
    ],
    32
  )

  // left side
  uvArray.set(
    [
      ...[0, 1],
      ...[first(textureWidth), 1], //
      ...[0, 0],
      ...[first(textureWidth), 0],
    ],
    40
  )

  geometry.attributes.uv.needsUpdate = true
}

function useCachedGeometry(heightBoxes: number, widthBoxes: number) {
  // reuse geometries for same size
  const geometries = useRef(new Map<string, THREE.BoxGeometry>())

  const id = `${heightBoxes}-${widthBoxes}`

  const getGeometry = useCallback(
    (id: string): THREE.BoxGeometry => {
      if (geometries.current.has(id)) {
        return geometries.current.get(id)!
      }

      // TODO: adjust w/ neuron box size?
      const geom = new THREE.BoxGeometry(
        0.2,
        heightBoxes * 0.2,
        widthBoxes * 0.2
      )
      updateUvMapping(geom, heightBoxes, widthBoxes)

      geometries.current.set(id, geom)
      return geom
    },
    [heightBoxes, widthBoxes]
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
