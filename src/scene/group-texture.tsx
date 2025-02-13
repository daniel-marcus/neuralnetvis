import { useEffect, useMemo } from "react"
import { useGroupPosition } from "./neuron-group"
import type { NeuronGroupProps } from "@/neuron-layers/types"

import * as THREE from "three"
import { useSelected } from "@/neuron-layers/neuron-select"

const BOX_SIZE = 5 // 4x4 +1 gap

export function GroupWithTexture(props: NeuronGroupProps) {
  const { group } = props
  const ref = useGroupPosition(props)

  const activations = group.neurons.map((n) => n.normalizedActivation)
  const width = Math.ceil(Math.sqrt(activations.length))

  const texture = useMemo(() => {
    return generateActivationTexture(activations)
  }, [activations])

  const geometry = useMemo(
    () => new THREE.BoxGeometry(0.2, width * 0.2, width * 0.2),
    [width]
  )

  useUvMapping(geometry, width)

  const setHovered = useSelected((s) => s.setHovered)

  return (
    <mesh
      ref={ref}
      onPointerMove={(event) => {
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
    >
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial map={texture} />
    </mesh>
  )
}

function generateActivationTexture(activations: (number | undefined)[]) {
  const width = Math.ceil(Math.sqrt(activations.length))

  const sideSize = width * BOX_SIZE - 1
  const data = new Uint8Array(sideSize * sideSize * 4)

  activations.forEach((activation, i) => {
    const value = activation ?? 0
    const x = (i % width) * BOX_SIZE
    const y = Math.floor(i / width) * BOX_SIZE

    for (let dy = 0; dy < BOX_SIZE - 1; dy++) {
      for (let dx = 0; dx < BOX_SIZE - 1; dx++) {
        // if (!activation) continue // TODO: painting too expensive: maybe use canves?
        const index = ((sideSize - 1 - y - dy) * sideSize + x + dx) * 4
        data[index] = Math.floor(value * 255) // R
        data[index + 1] = 20 // G
        data[index + 2] = 100 // B
        data[index + 3] = 255 // A
      }
    }
  })

  const texture = new THREE.DataTexture(
    data,
    sideSize,
    sideSize,
    THREE.RGBAFormat
  )

  texture.colorSpace = THREE.SRGBColorSpace

  texture.needsUpdate = true
  return texture
}

function useUvMapping(geometry: THREE.BufferGeometry, width: number) {
  useEffect(() => {
    // https://discoverthreejs.com/book/first-steps/textures-intro/
    const box = BOX_SIZE - 1 // minus gap
    const textureWidth = width * BOX_SIZE - 1

    const first = box / textureWidth
    const last = (textureWidth - box) / textureWidth
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

    // right side
    uvArray.set(
      [
        ...[last, 1],
        ...[1, 1], //
        ...[last, 0],
        ...[1, 0],
      ],
      32
    )

    // left side
    uvArray.set(
      [
        ...[0, 1],
        ...[first, 1], //
        ...[0, 0],
        ...[first, 0],
      ],
      40
    )

    // top
    uvArray.set(
      [
        ...[0, 1],
        ...[0, last],
        ...[1, 1],
        ...[1, last], //
      ],
      16
    )

    // bottom
    uvArray.set(
      [
        ...[1, first],
        ...[1, 0],
        ...[0, first],
        ...[0, 0], //
      ],
      24
    )

    geometry.attributes.uv.needsUpdate = true
  }, [geometry, width])
}
