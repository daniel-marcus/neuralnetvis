import * as THREE from "three/webgpu"
import { abs, mix, pow, varying, uv, floor, mod } from "three/tsl"
import { vec2, vec3, vec4 } from "three/tsl"
import { texture, instanceIndex, uniform } from "three/tsl"
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

export type StorageNode = THREE.StorageBufferNode<"float">

// per-object uniform: value is read from object.userData before each draw, so the material can be shared between layers
function objectUniform<T extends object>(key: keyof T & string) {
  return uniform(0).onObjectUpdate(({ object }) => getUserDataValue<T>(object, key))
}

function objectUniformUint<T extends object>(key: keyof T & string) {
  return uniform(0, "uint").onObjectUpdate(({ object }) => getUserDataValue<T>(object, key))
}

function getUserDataValue<T extends object>(object: THREE.Object3D | null, key: keyof T) {
  return object ? ((object.userData as T)[key] as number) : undefined
}

const texUniform = (key: keyof UserDataTextured & string) => objectUniform<UserDataTextured>(key)

export function getMaterial(hasColors: boolean, channelIdx: number, storageNode: StorageNode) {
  // instanced meshes can't share the node build anyway (three.js includes object.uuid in the cache key)
  return createActivationMaterial(hasColors, channelIdx, storageNode)
}

function createActivationMaterial(
  hasColors: boolean,
  channelIdx: number,
  storageNode: StorageNode,
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

function activationColor(hasColors: boolean, channelIdx: number, storageNode: StorageNode) {
  const posBase = hasColors ? colorBases[channelIdx] : basePos
  // @ts-expect-error function not fully typed
  return Fn(({ object, renderer: { backend } }: FnProps) => {
    const { instancedActivations } = object.userData as UserData
    const idx = instanceIndex.add(objectUniformUint<UserData>("bufferOffset"))
    const normalizedNode = isWebGPUBackend(backend)
      ? storageNode.element(idx) // uniformArray(activations.array) would also work for WebGL fallback, but is slow in compilation
      : instancedBufferAttribute<"float">(instancedActivations)
    const baseNode = normalizedNode.greaterThanEqual(0.0).select<"vec3">(posBase, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const vColor = pow(srgbColor, vec3(2.2))
    return varying(vColor) // compute in vertex stage
  })()
}

const sharedTextureMaterials = new WeakMap<StorageNode, Map<string, THREE.NodeMaterial>>()
const isShared = new WeakSet<THREE.Material>()

// WebGPU: all textured layers with the same buffer page share one material (per color channel),
// so three.js builds the node graph only once. Layer-specific values come from per-object uniforms.
// WebGL fallback samples a per-layer texture, so it needs a separate material for each layer.
export function getTextureMaterial(
  hasColors: boolean,
  channelIdx: number,
  storageNode: StorageNode,
  shared: boolean,
) {
  if (!shared) return createTextureMaterial(hasColors, channelIdx, storageNode)
  let cache = sharedTextureMaterials.get(storageNode)
  if (!cache) {
    cache = new Map()
    sharedTextureMaterials.set(storageNode, cache)
  }
  const key = hasColors ? `color_${channelIdx}` : "default"
  let material = cache.get(key)
  if (!material) {
    material = createTextureMaterial(hasColors, channelIdx, storageNode)
    isShared.add(material)
    cache.set(key, material)
  }
  return material
}

export function releaseTextureMaterial(material: THREE.Material) {
  if (!isShared.has(material)) material.dispose()
}

function createTextureMaterial(hasColors: boolean, channelIdx: number, storageNode: StorageNode) {
  const material = hasColors
    ? new THREE.MeshBasicNodeMaterial({ blending: THREE.AdditiveBlending })
    : new THREE.MeshStandardNodeMaterial()
  material.transparent = !hasColors // transparency needed for gaps between kernels in Conv layers etc.
  material.colorNode = activationColorTexture(hasColors, channelIdx, storageNode)
  return material
}

function activationColorTexture(
  hasColors: boolean,
  channelIdx: number,
  storageNode: StorageNode,
  cellGap = 1,
) {
  const posBase = hasColors ? colorBases[channelIdx] : basePos
  // @ts-expect-error function not fully typed
  return Fn(({ object, renderer: { backend } }: FnProps) => {
    // don't read layer-specific values from userData here, the material might be shared (use texUniform instead)
    const width = texUniform("width")
    const height = texUniform("height")
    const channels = texUniform("channels")

    const uvNode = uv()
    const fragCoord = floor(uvNode.mul(vec2(texUniform("texWidth"), texUniform("texHeight"))))

    const tileWidth = width.add(cellGap)
    const tileHeight = height.add(cellGap)

    const tileX = floor(fragCoord.x.div(tileWidth))
    const tileY = floor(fragCoord.y.div(tileHeight))
    const channel = floor(tileY.mul(texUniform("gridCols")).add(tileX))

    If(channel.greaterThanEqual(channels), () => Discard())

    const localX = floor(mod(fragCoord.x, tileWidth))
    const localY = floor(mod(fragCoord.y, tileHeight))

    If(localX.greaterThanEqual(width), () => Discard())
    If(localY.greaterThanEqual(height), () => Discard())

    /*
    return vec3(  // DEBUG: use this to visualize the grid
      channel.div(channels),
      localX.div(width),
      localY.div(height)
    )
    */

    const idx = localY.mul(width.mul(channels)).add(localX.mul(channels)).add(channel)

    // uint: offsets in a shared buffer page can exceed float precision (2^24)
    const idxWithOffset = idx.toUint().add(objectUniformUint<UserDataTextured>("bufferOffset"))
    // WebGPU can pick the value directly from the storage buffer, WebGL needs precomputed texture
    const normalizedNode = isWebGPUBackend(backend)
      ? storageNode.element(idxWithOffset)
      : texture((object.userData as UserDataTextured).actTexture).r // TODO: find a way to use activations w/ idx (bufferAttribute/uniformArray) in WebGL

    if (!isWebGPUBackend(backend)) {
      If(normalizedNode.lessThanEqual(-900.0), () => {
        // -999.0 used as marker for empty (transparent) pixels
        Discard()
      })
    }

    const baseNode = normalizedNode.greaterThanEqual(0.0).select<"vec3">(posBase, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const colorNode = pow(srgbColor, vec3(2.2))
    return colorNode
  })()
}

// https://github.com/pmndrs/drei/blob/master/src/materials/DiscardMaterial.tsx
const discardMaterial = new THREE.NodeMaterial()
discardMaterial.transparent = true
discardMaterial.colorNode = vec4(0, 0, 0, 0)

function normalizeColor(arr: number[]) {
  return new THREE.Color(...arr.map((v) => v / 255))
}
