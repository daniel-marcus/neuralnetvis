import * as THREE from "three/webgpu"
import { NEG_BASE, POS_BASE, ZERO_BASE } from "@/utils/colors"
import { Normalization, type NormalizationType } from "./materials"

interface CustomShaderMaterialProps extends THREE.MaterialParameters {
  baseZero?: number[] // [r, g, b] for base color
  basePos?: number[] // [r, g, b] for positive activation color
  baseNeg?: number[] // [r, g, b] for negative activation color
  addBlend?: boolean // use additive blending for color channels
  normalization?: NormalizationType
}

export function createShaderMaterial(args?: CustomShaderMaterialProps) {
  const {
    baseZero = ZERO_BASE,
    basePos = POS_BASE,
    baseNeg = NEG_BASE,
    addBlend = false,
    normalization = Normalization.NONE,
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
    maxAbsActivation: { value: Infinity },
    normalizationMode: { value: normalization },
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms = { ...shader.uniforms, ...material.userData.uniforms }

    shader.vertexShader = shader.vertexShader.replace(
      `#include <common>`,
      /* glsl */ `
        #include <common>
        uniform vec3 baseZero;
        uniform vec3 basePos;
        uniform vec3 baseNeg;
        uniform float maxAbsActivation;
        uniform float normalizationMode;
        `
    )

    shader.vertexShader = shader.vertexShader.replace(
      `#include <color_vertex>`,
      /* glsl */ `
        float activation = instanceColor.r;
        float colorValue = activation;
        if (int(normalizationMode) == ${Normalization.PER_LAYER_MAX_ABS}) {
          colorValue = activation / max(maxAbsActivation, 1e-6);
        }
        vec3 base = colorValue >= 0.0 ? basePos : baseNeg;
        vec3 srgbColor = mix(baseZero, base, abs(colorValue));
        vColor = srgbColor;
        `
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <color_fragment>`,
      /* glsl */ `diffuseColor.rgb = pow(vColor, vec3(2.2));` // gamma correction
    )
  }
  return material
}

interface CustomShaderMaterialForTextureProps
  extends CustomShaderMaterialProps {
  activationTexture: THREE.Texture
}

export function createShaderMaterialForTexture({
  activationTexture,
  baseZero = ZERO_BASE,
  basePos = POS_BASE,
  baseNeg = NEG_BASE,
  normalization = Normalization.NONE,
  ...rest
}: CustomShaderMaterialForTextureProps): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ ...rest })

  material.transparent = true

  material.userData.uniforms = {
    activationTex: { value: activationTexture },
    baseZero: { value: normalizeColor(baseZero) },
    basePos: { value: normalizeColor(basePos) },
    baseNeg: { value: normalizeColor(baseNeg) },
    maxAbsActivation: { value: Infinity },
    normalizationMode: { value: normalization },
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms = { ...shader.uniforms, ...material.userData.uniforms }

    shader.vertexShader = shader.vertexShader.replace(
      `#include <common>`,
      /* glsl */ `
        #include <common>
        varying vec2 vUv;
      `
    )

    shader.vertexShader = shader.vertexShader.replace(
      `#include <uv_vertex>`,
      /* glsl */ `
        #include <uv_vertex>
        vUv = uv;
      `
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <common>`,
      /* glsl */ `
        #include <common>
        uniform sampler2D activationTex;
        uniform vec3 baseZero;
        uniform vec3 basePos;
        uniform vec3 baseNeg;
        uniform float maxAbsActivation;
        uniform float normalizationMode;
        varying vec2 vUv;
      `
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <color_fragment>`,
      /* glsl */ `
        float activation = texture2D(activationTex, vUv).r;
        if (activation < -900.0) {
          discard;
        }
        float colorValue = activation;
        if (int(normalizationMode) == ${Normalization.PER_LAYER_MAX_ABS}) {
          colorValue = activation / max(maxAbsActivation, 1e-6);
        }
        vec3 base = colorValue >= 0.0 ? basePos : baseNeg;
        vec3 srgbColor = mix(baseZero, base, abs(colorValue));
        diffuseColor.rgb = pow(srgbColor, vec3(2.2));
      `
    )
  }

  return material
}

export function normalizeColor(arr: number[]) {
  return new THREE.Color(...arr.map((v) => v / 255))
}
