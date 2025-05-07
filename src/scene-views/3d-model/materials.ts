import { NEG_BASE, POS_BASE, ZERO_BASE } from "@/utils/colors"
import * as THREE from "three"

interface CustomShaderMaterialProps extends THREE.MaterialParameters {
  baseZero?: number[] // [r, g, b] for base color
  basePos?: number[] // [r, g, b] for positive activation color
  baseNeg?: number[] // [r, g, b] for negative activation color
  addBlend?: boolean // use additive blending for color channels
}

export function createShaderMaterial(args?: CustomShaderMaterialProps) {
  const {
    baseZero = ZERO_BASE,
    basePos = POS_BASE,
    baseNeg = NEG_BASE,
    addBlend = false,
    ...rest
  } = args ?? {}

  const blending = addBlend ? THREE.AdditiveBlending : THREE.NormalBlending

  const MaterialClass = addBlend
    ? THREE.MeshBasicMaterial
    : THREE.MeshStandardMaterial

  const material = new MaterialClass({ ...rest, blending })

  material.userData.uniforms = {
    baseZero: { value: normalizeColor(baseZero) },
    basePos: { value: normalizeColor(basePos) },
    baseNeg: { value: normalizeColor(baseNeg) },
  }

  // Inject shader customization
  material.onBeforeCompile = (shader) => {
    shader.uniforms.baseZero = material.userData.uniforms.baseZero
    shader.uniforms.basePos = material.userData.uniforms.basePos
    shader.uniforms.baseNeg = material.userData.uniforms.baseNeg

    shader.vertexShader = shader.vertexShader.replace(
      `#include <common>`,
      `
        #include <common>
        uniform vec3 baseZero;
        uniform vec3 basePos;
        uniform vec3 baseNeg;
        `
    )

    shader.vertexShader = shader.vertexShader.replace(
      `#include <color_vertex>`,
      `
        float activation = instanceColor.r;
        vec3 base = activation >= 0.0 ? basePos : baseNeg;
        float val = abs(activation);
        vec3 srgbColor = mix(baseZero, base, val);
        vColor = pow(srgbColor, vec3(2.2));
        `
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <color_fragment>`,
      `diffuseColor.rgb = vColor;`
    )
  }
  return material
}

function normalizeColor(arr: number[]) {
  return new THREE.Color(...arr.map((v) => v / 255))
}
