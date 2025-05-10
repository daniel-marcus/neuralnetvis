import * as THREE from "three/webgpu"
import {
  abs,
  instancedBufferAttribute,
  max,
  mix,
  pow,
  texture,
  userData,
  uv,
  vec3,
} from "three/tsl"
import { Fn, If, Discard } from "three/tsl"
import { normalizeColor } from "./materials-glsl"
import { NEG_BASE, POS_BASE, ZERO_BASE } from "@/utils/colors"

const baseZero = vec3(...normalizeColor(ZERO_BASE))
const basePos = vec3(...normalizeColor(POS_BASE))
const baseNeg = vec3(...normalizeColor(NEG_BASE))
const baseR = vec3(1, 0, 0)
const baseG = vec3(0, 1, 0)
const baseB = vec3(0, 0, 1)
const colorBases = [baseR, baseG, baseB]

export const activationColor = (channelIdx?: number) => {
  const posBase =
    typeof channelIdx === "number" ? colorBases[channelIdx] : basePos
  // @ts-expect-error missing type TODO
  return Fn(({ object }) => {
    const { activations } = object.userData
    const activation = instancedBufferAttribute(activations, "float")
    const maxAbsNode = userData("maxAbs", "float")
    const normalizationMode = userData("normalization", "int")
    const normalizedNode = normalizationMode
      .greaterThanEqual(1)
      .select(activation.div(max(maxAbsNode, 1e-6)), activation)
    const baseNode = normalizedNode
      .greaterThanEqual(0.0)
      .select(posBase, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const colorNode = pow(srgbColor, vec3(2.2))
    return colorNode
  })()
}

export const activationColorTexture = (
  map: THREE.DataTexture,
  maxAbsNode: THREE.TSL.ShaderNodeObject<THREE.UniformNode<number>>
) => {
  return Fn(() => {
    const activationNode = texture(map, uv()).r
    If(activationNode.lessThan(-900.0), () => {
      Discard()
    })
    const normalizedNode = activationNode.div(max(maxAbsNode, 1e-6))
    const baseNode = normalizedNode
      .greaterThanEqual(0.0)
      .select(basePos, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const colorNode = pow(srgbColor, vec3(2.2))
    return colorNode
  })()
}
