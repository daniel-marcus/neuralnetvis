import * as THREE from "three/webgpu"
import { abs, mix, pow, varying, uv, float, floor, mod } from "three/tsl"
import { vec2, vec3, vec4 } from "three/tsl"
import { texture, instanceIndex } from "three/tsl"
import { Fn, If, Discard, instancedBufferAttribute } from "three/tsl"
import { isWebGPUBackend } from "@/utils/webgpu"
import { NEG_BASE, POS_BASE, ZERO_BASE } from "@/utils/colors"
import type { UserData } from "./layer-instanced"
import type { UserDataTextured } from "./layer-textured"

const baseZero = vec3(...normalizeColor(ZERO_BASE))
const basePos = vec3(...normalizeColor(POS_BASE))
const baseNeg = vec3(...normalizeColor(NEG_BASE))
const baseR = vec3(1, 0, 0)
const baseG = vec3(0, 1, 0)
const baseB = vec3(0, 0, 1)
const colorBases = [baseR, baseG, baseB]

// const standardMaterial = createActivationMaterial(false, 0)
// const colorMaterials = [0, 1, 2].map((i) => createActivationMaterial(true, i))

export type StorageNode = THREE.TSL.ShaderNodeObject<THREE.StorageBufferNode>

export function getMaterial(
  hasColors: boolean,
  channelIdx: number,
  storageNode: THREE.TSL.ShaderNodeObject<THREE.StorageBufferNode>
) {
  return createActivationMaterial(hasColors, channelIdx, storageNode)
  // return hasColors ? colorMaterials[channelIdx] : standardMaterial
}

function createActivationMaterial(
  hasColors: boolean,
  channelIdx: number,
  storageNode: THREE.TSL.ShaderNodeObject<THREE.StorageBufferNode>
) {
  const material = hasColors
    ? new THREE.MeshBasicNodeMaterial({ blending: THREE.AdditiveBlending })
    : new THREE.MeshStandardNodeMaterial()
  material.colorNode = activationColor(hasColors, channelIdx, storageNode)
  return material
}

interface FnProps {
  object: THREE.Object3D
  renderer: THREE.WebGPURenderer
}

export function activationColor(
  hasColors: boolean,
  channelIdx: number,
  storageNode: THREE.TSL.ShaderNodeObject<THREE.StorageBufferNode>
) {
  const posBase = hasColors ? colorBases[channelIdx] : basePos
  // @ts-expect-error function not fully typed
  return Fn(({ object, renderer: { backend } }: FnProps) => {
    const { activations, instancedActivations } = object.userData as UserData
    const offset = hasColors ? channelIdx * (activations.array.length / 3) : 0
    const idx = instanceIndex.add(offset)
    const normalizedNode = isWebGPUBackend(backend)
      ? storageNode.element(idx) // uniformArray(activations.array) would also work for WebGL fallback, but is slow in compilation
      : instancedBufferAttribute(instancedActivations)
    const baseNode = normalizedNode
      .greaterThanEqual(0.0)
      .select(posBase, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const vColor = pow(srgbColor, vec3(2.2))
    return varying(vColor) // compute in vertex stage
  })()
}

export function getTextureMaterial(
  hasColors: boolean,
  channelIdx: number,
  height: number,
  width: number,
  channels: number,
  storageNode: StorageNode
) {
  const material = hasColors
    ? new THREE.MeshBasicNodeMaterial({ blending: THREE.AdditiveBlending })
    : new THREE.MeshStandardNodeMaterial()
  material.transparent = !hasColors // transparency needed for gaps between kernels in Conv layers etc.
  material.colorNode = activationColorTexture(
    hasColors,
    channelIdx,
    height,
    width,
    channels,
    storageNode
  )
  return material
}

// TODO: use uniforms for height, width, channels?
export function activationColorTexture(
  hasColors: boolean,
  channelIdx: number,
  height: number,
  width: number,
  channels: number,
  storageNode: StorageNode,
  cellGap = 1
) {
  const posBase = hasColors ? colorBases[channelIdx] : basePos
  // @ts-expect-error function not fully typed
  return Fn(({ object, renderer: { backend } }: FnProps) => {
    const { activations, actTexture } = object.userData as UserDataTextured
    // TODO: DRY (see DataTexture in layer-textured.tsx) / pixelMAp
    const gridCols = Math.ceil(Math.sqrt(channels))
    const gridRows = Math.ceil(channels / gridCols)

    const texWidth = gridCols * width + (gridCols - 1) * cellGap
    const texHeight = gridRows * height + (gridRows - 1) * cellGap

    const uvNode = uv()
    const fragCoord = floor(uvNode.mul(vec2(float(texWidth), float(texHeight))))

    const tileWidth = float(width + cellGap)
    const tileHeight = float(height + cellGap)

    const tileX = floor(fragCoord.x.div(tileWidth))
    const tileY = floor(fragCoord.y.div(tileHeight))
    const channel = floor(tileY.mul(gridCols).add(tileX))

    const localX = floor(mod(fragCoord.x, tileWidth))
    const localY = floor(mod(fragCoord.y, tileHeight))

    If(localX.greaterThanEqual(float(width)), () => Discard())
    If(localY.greaterThanEqual(float(height)), () => Discard())

    /* 
    return vec3(  // DEBUG: use this to visualize the grid
      channel.div(float(channels)),
      localX.div(float(width)),
      localY.div(float(height))
    )
    */

    const idx = localY
      .mul(float(width * channels))
      .add(localX.mul(float(channels)))
      .add(channel)

    const offset = hasColors ? channelIdx * (activations.array.length / 3) : 0
    const idxWithOffset = idx.add(offset)
    // WebGPU can pick the value directly from the storage buffer, WebGL needs precomputed texture
    const normalizedNode = isWebGPUBackend(backend)
      ? storageNode.element(idxWithOffset)
      : texture(actTexture).r // TODO: find a way to use activations w/ idx (bufferAttribute/uniformArray) in WebGL

    if (!isWebGPUBackend(backend)) {
      If(normalizedNode.lessThanEqual(-900.0), () => {
        // -999.0 used as marker for empty (transparent) pixels
        Discard()
      })
    }

    const baseNode = normalizedNode
      .greaterThanEqual(0.0)
      .select(posBase, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const colorNode = pow(srgbColor, vec3(2.2))
    return colorNode
  })()
}

// https://github.com/pmndrs/drei/blob/master/src/materials/DiscardMaterial.tsx
export const discardMaterial = new THREE.NodeMaterial()
discardMaterial.transparent = true
discardMaterial.colorNode = vec4(0, 0, 0, 0)

function normalizeColor(arr: number[]) {
  return new THREE.Color(...arr.map((v) => v / 255))
}
