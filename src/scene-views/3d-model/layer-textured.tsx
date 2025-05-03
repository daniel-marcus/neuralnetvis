import { useCallback, useMemo, useRef } from "react"
import * as THREE from "three"
import { useLayerActivations } from "@/model/activations"
import { useLayerInteractions } from "./interactions"
import type { NeuronLayer } from "@/neuron-layers/types"
import type { LayerActivations } from "@/model"

const BOX_SIZE = 1 // including BOX_GAP
const BOX_GAP = 0
const GROUP_GAP = 1

export function TexturedLayer(props: NeuronLayer) {
  const [texture, heightBoxes, widthBoxes] = useActivationTexture(props)
  const geometry = useCachedGeometry(heightBoxes, widthBoxes)
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
  const gridCols = Math.ceil(Math.sqrt(channels))
  const gridRows = Math.ceil(channels / gridCols)

  const channelWidth = width * BOX_SIZE - BOX_GAP
  const channelHeight = height * BOX_SIZE - BOX_GAP

  const totalWidth = gridCols * channelWidth + (gridCols - 1) * GROUP_GAP
  const totalHeight = gridRows * channelHeight + (gridRows - 1) * GROUP_GAP

  const data = new Uint8Array(totalWidth * totalHeight * 4).fill(0)

  for (let channel = 0; channel < channels; channel++) {
    const gridX = channel % gridCols
    const gridY = Math.floor(channel / gridCols)

    const blockX = gridX * (channelWidth + GROUP_GAP)
    const blockY = gridY * (channelHeight + GROUP_GAP)

    for (let h = 0; h < height; h++) {
      for (let w = 0; w < width; w++) {
        const idx = h * (width * channels) + w * channels + channel
        const [r, g, b] = layerActivations?.colors[idx]?.rgbArr ?? [0, 0, 0]
        const a = 255

        const squareX = w * BOX_SIZE
        const squareY = h * BOX_SIZE

        // Draw colored square
        for (let dy = 0; dy < BOX_SIZE - BOX_GAP; dy++) {
          for (let dx = 0; dx < BOX_SIZE - BOX_GAP; dx++) {
            const x = blockX + squareX + dx
            const y = blockY + squareY + dy

            if (x >= totalWidth || y >= totalHeight) continue

            const flippedY = totalHeight - 1 - y // bc/ three.js texture pixels start bottom-left
            const offset = (flippedY * totalWidth + x) * 4
            data.set([r, g, b, a], offset)
          }
        }
      }
    }
  }

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
  const height = heightBoxes * BOX_SIZE - BOX_GAP
  const width = widthBoxes * BOX_SIZE - BOX_GAP

  const first = (base: number) => box / base
  const last = (base: number) => (base - box) / base

  const uvAttr = geometry.attributes.uv
  type UV = [number, number]
  const uvSet = (uv1: UV, uv2: UV, uv3: UV, uv4: UV, offset: number) =>
    uvAttr.array.set([...uv1, ...uv2, ...uv3, ...uv4], offset)

  const o = { BACK: 0, TOP: 16, BOTTOM: 24, RIGHT: 32, LEFT: 40 }

  uvSet([1, 1], [0, 1], [1, 0], [0, 0], o.BACK)
  uvSet([0, 1], [0, last(height)], [1, 1], [1, last(height)], o.TOP)
  uvSet([1, first(height)], [1, 0], [0, first(height)], [0, 0], o.BOTTOM)
  uvSet([last(width), 1], [1, 1], [last(width), 0], [1, 0], o.RIGHT)
  uvSet([0, 1], [first(width), 1], [0, 0], [first(width), 0], o.LEFT)

  uvAttr.needsUpdate = true
}

// reuse geometries for same size
function useCachedGeometry(heightBoxes: number, widthBoxes: number) {
  const geometries = useRef(new Map<string, THREE.BoxGeometry>())
  const id = `${heightBoxes}-${widthBoxes}`

  const getGeometry = useCallback(
    (id: string): THREE.BoxGeometry => {
      if (geometries.current.has(id)) return geometries.current.get(id)!

      const BOX_SIZE_THREE = 0.2 // TODO: adjust w/ neuron box size?
      const size = [1, heightBoxes, widthBoxes].map((v) => v * BOX_SIZE_THREE)
      const geom = new THREE.BoxGeometry(...size)
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
