import * as THREE from "three/webgpu"
import { abs, float, max, mix, pow, uv, vec3, vec4 } from "three/tsl"
import { Fn, If, Discard, select } from "three/tsl"
import { texture, storage, instanceIndex } from "three/tsl"
import { normalizeColor } from "./materials-glsl"
import { NEG_BASE, POS_BASE, ZERO_BASE } from "@/utils/colors"
import { UserData } from "./layer-instanced"
import { UserDataTextured } from "./layer-textured"

export const Normalization = {
  NONE: 0,
  PER_LAYER_MAX_ABS: 1,
  PER_NEURON_SCALE_NORM: 1, // TODO 2
} as const

export type NormalizationType =
  (typeof Normalization)[keyof typeof Normalization]

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

export function activationColor(hasColors: boolean, channelIdx: number) {
  const posBase = hasColors ? colorBases[channelIdx] : basePos
  // @ts-expect-error function not fully typed
  return Fn(({ object }) => {
    const { activations } = object.userData as UserData
    const normalizedNode = storage(activations).element(instanceIndex)
    const baseNode = normalizedNode
      .greaterThanEqual(0.0)
      .select(posBase, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const colorNode = pow(srgbColor, vec3(2.2))
    return colorNode
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
  return Fn(({ object }) => {
    const { activations, mapTexture } = object.userData as UserDataTextured
    const idx = texture(mapTexture).r
    If(idx.lessThan(-900.0), () => {
      // -999.0 used as marker for empty (transparent) pixels
      Discard()
    })
    const normalizedNode = storage(activations).element(idx)
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
