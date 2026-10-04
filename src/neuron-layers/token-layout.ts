import type { TokenizerType } from "@/data/tokenizer"

// Text input layers (tokenizer datasets): the tokens are laid out like a paragraph, as tiles with the
// width of the decoded token. All units are world units, x: reading direction, y: up.

export const TOKEN_CHAR_W = 0.3 // monospace advance width
export const TOKEN_TILE_H = 0.6
const TILE_PAD = 0.12 // left and right of the text
const TILE_GAP = 0.12
const LINE_H = 0.85
const MAX_LINE_W = 18
const MAX_CHARS = 16 // longer tokens are truncated with …

export interface TokenTile {
  text: string
  x: number // center, relative to the paragraph center
  y: number
  width: number
  isPadding: boolean
}

export interface TokenParagraph {
  tiles: TokenTile[]
  width: number
  height: number
}

export function getTokenTexts(tokens: ArrayLike<number>, tokenizer: TokenizerType) {
  return Array.from(tokens, (token) => getTokenText(tokenizer.decode(token)))
}

function getTokenText(decoded: string) {
  const text = decoded.replace(/^ +/, "").replaceAll("\n", "↵") // BPE: leading space = word boundary
  if (!text) return "·" // whitespace-only token
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text
}

// numVisible: tokens after that are padding, they get the position of the last visible token
export function layoutTokens(texts: string[], numVisible = texts.length): TokenParagraph {
  const tiles: TokenTile[] = []
  let x = 0
  let line = 0
  let maxX = 0
  for (const [i, text] of texts.entries()) {
    const isPadding = i >= numVisible
    if (isPadding) {
      const last = tiles[numVisible - 1] ?? { x: 0, y: 0, width: 0 }
      tiles.push({ text, x: last.x, y: last.y, width: 0, isPadding })
      continue
    }
    const width = text.length * TOKEN_CHAR_W + 2 * TILE_PAD
    if (x > 0 && x + width > MAX_LINE_W) {
      x = 0
      line++
    }
    tiles.push({ text, x: x + width / 2, y: -line * LINE_H, width, isPadding })
    x += width + TILE_GAP
    maxX = Math.max(maxX, x - TILE_GAP)
    if (text.endsWith("↵")) {
      x = 0
      line++
    }
  }
  const numLines = tiles.length ? -Math.min(...tiles.map((t) => t.y)) / LINE_H + 1 : 0
  const width = maxX
  const height = numLines ? (numLines - 1) * LINE_H + TOKEN_TILE_H : 0
  // center the paragraph
  const offsetX = -width / 2
  const offsetY = (height - TOKEN_TILE_H) / 2
  for (const tile of tiles) {
    tile.x += offsetX
    tile.y += offsetY
  }
  return { tiles, width, height }
}
