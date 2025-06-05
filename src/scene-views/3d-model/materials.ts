import * as THREE from "three/webgpu"
import { Fn, If, Discard, abs, mix, pow, varying, vec3, vec4 } from "three/tsl"
import { texture, storage, instanceIndex } from "three/tsl"
import { instancedBufferAttribute } from "three/tsl"
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

const standardMaterial = createActivationMaterial(false, 0)
const colorMaterials = [0, 1, 2].map((i) => createActivationMaterial(true, i))

export function getMaterial(hasColors: boolean, channelIdx: number) {
  return hasColors ? colorMaterials[channelIdx] : standardMaterial
}

function createActivationMaterial(hasColors: boolean, channelIdx: number) {
  const material = hasColors
    ? new THREE.MeshBasicNodeMaterial({ blending: THREE.AdditiveBlending })
    : new THREE.MeshStandardNodeMaterial()
  material.colorNode = activationColor(hasColors, channelIdx)
  return material
}

interface FnProps {
  object: THREE.Object3D
  renderer: THREE.WebGPURenderer
}

export function activationColor(hasColors: boolean, channelIdx: number) {
  const posBase = hasColors ? colorBases[channelIdx] : basePos
  // @ts-expect-error function not fully typed
  return Fn(({ object, renderer: { backend } }: FnProps) => {
    const { activations, instancedActivations } = object.userData as UserData
    const offset = hasColors ? channelIdx * (activations.array.length / 3) : 0
    const idx = instanceIndex.add(offset)
    const normalizedNode = isWebGPUBackend(backend)
      ? storage(activations).element(idx) // uniformArray(activations.array) would also work for WebGL fallback, but is slow in compilation
      : instancedBufferAttribute(instancedActivations)
    const baseNode = normalizedNode
      .greaterThanEqual(0.0)
      .select(posBase, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const vColor = pow(srgbColor, vec3(2.2))
    return varying(vColor) // compute in vertex stage
  })()
}

export function getTextureMaterial() {
  const material = new THREE.MeshStandardNodeMaterial()
  material.transparent = true
  material.colorNode = activationColorTexture()
  return material
}

export function activationColorTexture() {
  // @ts-expect-error function not fully typed
  return Fn(({ object, renderer: { backend } }: FnProps) => {
    const { activations, mapTexture, actTexture } =
      object.userData as UserDataTextured
    const idx = texture(mapTexture).r
    If(idx.lessThan(-900.0), () => {
      // -999.0 used as marker for empty (transparent) pixels
      Discard()
    })
    // WebGPU can pick the value directly from the storage buffer, WebGL needs precomputed texture
    const normalizedNode = isWebGPUBackend(backend)
      ? storage(activations).element(idx)
      : texture(actTexture).r
    const baseNode = normalizedNode
      .greaterThanEqual(0.0)
      .select(basePos, baseNeg)
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
