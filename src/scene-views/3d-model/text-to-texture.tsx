import * as THREE from "three/webgpu"

// reference: https://github.com/vasturiano/three-spritetext/blob/master/src/index.js

interface Text2TextureProps {
  text: string
  fontSize?: number
  fontFace: string
  color: string
  align?: "left" | "center" | "right"
}

type Text2TextureResult = {
  texture: THREE.CanvasTexture
  scale: [number, number, number]
}
const text2TextureCache = new Map<string, Text2TextureResult>()

export function text2Texture(props: Text2TextureProps): Text2TextureResult {
  const { text, fontSize = 90, fontFace, color, align = "left" } = props

  const key = `${text}-${fontSize}-${fontFace}-${color}-${align}`
  if (text2TextureCache.has(key)) {
    return text2TextureCache.get(key)!
  }

  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  const lines = text.split("\n")
  const font = `${fontSize}px ${fontFace}`

  ctx.font = font
  const innerWidth = Math.max(
    ...lines.map((line) => ctx.measureText(line).width)
  )
  const paddingY = fontSize * 0.15
  const lineHeight = 1.1
  const innerHeight = fontSize * lineHeight * lines.length + 2 * paddingY
  canvas.width = innerWidth
  canvas.height = innerHeight

  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = "bottom"
  ctx.textAlign = align

  ctx.textBaseline = "top"
  let lineX: number
  if (align === "left") lineX = 0
  else if (align === "center") lineX = innerWidth / 2
  else lineX = innerWidth
  lines.forEach((line, index) => {
    ctx.fillText(line, lineX, index * fontSize * lineHeight + paddingY)
  })

  const yScale = lineHeight * lines.length
  const xScale = (canvas.width / canvas.height) * yScale
  const scale = [xScale, yScale, 0] as [number, number, number]

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 1

  const result = { texture, scale }
  text2TextureCache.set(key, result)

  return result
}
