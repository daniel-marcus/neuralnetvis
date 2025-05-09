// reference: https://github.com/vasturiano/three-spritetext/blob/master/src/index.js

interface Text2CanvasProps {
  text: string
  fontSize?: number
  fontFace: string
  color: string
  align?: "left" | "center" | "right"
}

export function text2Canvas(props: Text2CanvasProps) {
  const { text, fontSize = 90, fontFace, color, align = "left" } = props
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")!

  const lines = text.split("\n")
  const font = `${fontSize}px ${fontFace}`

  ctx.font = font
  const innerWidth = Math.max(
    ...lines.map((line) => ctx.measureText(line).width)
  )
  const innerHeight = fontSize * lines.length
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
    ctx.fillText(line, lineX, index * fontSize)
  })

  return [canvas, lines.length] as const
}
