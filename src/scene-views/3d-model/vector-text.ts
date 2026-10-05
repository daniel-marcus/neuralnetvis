import * as THREE from "three/webgpu"
import { useLoader } from "@react-three/fiber"
import { FontLoader } from "three/addons/loaders/FontLoader.js"
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js"
import type { Font } from "three/addons/loaders/FontLoader.js"

// Text as flat vector glyphs (sharp at any zoom level), for fonts converted with scripts/font-to-typeface.mts
// Characters that are missing in the font are rendered as "?", check with hasAllGlyphs if needed

const FONT_URL = "/fonts/Menlo-Regular.typeface.json"
const CURVE_SEGMENTS = 4

export function useFont() {
  return useLoader(FontLoader, FONT_URL) // suspends while loading
}

export function hasAllGlyphs(font: Font, text: string) {
  return Array.from(text).every((char) => char === "\n" || char in font.data.glyphs)
}

interface TextGeometryOptions {
  fontSize: number
  align?: "left" | "center" | "right" // relative to x = 0
  lineHeight?: number
}

// geometry in the xy plane, facing +z, vertically centered at y = 0
export function textGeometry(font: Font, text: string, options: TextGeometryOptions) {
  const { fontSize, align = "left", lineHeight = fontSize * 1.25 } = options
  const { glyphs, resolution, ascender, descender } = font.data
  const scale = fontSize / resolution
  const lines = text.split("\n")
  const top = ascender * scale
  const bottom = -(lines.length - 1) * lineHeight + descender * scale
  const offsetY = -(top + bottom) / 2
  const geometries: THREE.BufferGeometry[] = []
  for (const [i, line] of lines.entries()) {
    const shapes = font.generateShapes(line, fontSize)
    if (!shapes.length) continue
    const width = Array.from(line).reduce((w, c) => w + (glyphs[c] ?? glyphs["?"]).ha * scale, 0)
    const x = align === "left" ? 0 : align === "right" ? -width : -width / 2
    const geometry = new THREE.ShapeGeometry(shapes, CURVE_SEGMENTS)
    geometry.translate(x, offsetY - i * lineHeight, 0)
    geometries.push(geometry)
  }
  return mergeAndDispose(geometries)
}

function mergeAndDispose(geometries: THREE.BufferGeometry[]) {
  const nonEmpty = geometries.filter((g) => g.hasAttribute("position")) // e.g. whitespace-only text
  if (nonEmpty.length === 1 && geometries.length === 1) return geometries[0]
  const merged = nonEmpty.length ? mergeGeometries(nonEmpty) : new THREE.BufferGeometry()
  for (const geometry of geometries) geometry.dispose()
  return merged
}
