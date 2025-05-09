import * as THREE from "three/webgpu"
import {
  abs,
  float,
  Fn,
  instanceIndex,
  max,
  mix,
  pow,
  storage,
  uniform,
  userData,
  vec3,
} from "three/tsl"
import { normalizeColor } from "./materials-glsl"
import { NEG_BASE, POS_BASE, ZERO_BASE } from "@/utils/colors"

// dependencies: hasColorChannels, channelIdx, splitColors, isSoftmax
// what can vary: basePos, normalization, material class
// default:

const baseZero = uniform(vec3(...normalizeColor(ZERO_BASE)))
const basePos = uniform(vec3(...normalizeColor(POS_BASE)))
const baseNeg = uniform(vec3(...normalizeColor(NEG_BASE)))
const baseR = uniform(vec3(1, 0, 0))
const baseG = uniform(vec3(0, 1, 0))
const baseB = uniform(vec3(0, 0, 1))
const colorBases = [baseR, baseG, baseB]

export const activationColor = (
  st: THREE.StorageInstancedBufferAttribute,
  maxAbsNode: THREE.TSL.ShaderNodeObject<THREE.UniformNode<number>>,
  normalize: boolean,
  channelIdx?: number
) => {
  const posBase =
    typeof channelIdx === "number" ? colorBases[channelIdx] : basePos
  return Fn(() => {
    const activations = storage(st)
    const activationNode = activations.element(instanceIndex)
    const normalizedNode = normalize
      ? activationNode.div(max(maxAbsNode, 1e-6))
      : activationNode
    const baseNode = normalizedNode
      .greaterThanEqual(0.0)
      .select(posBase, baseNeg)
    const srgbColor = mix(baseZero, baseNode, abs(normalizedNode))
    const colorNode = pow(srgbColor, vec3(2.2))
    return colorNode
  })()
}
