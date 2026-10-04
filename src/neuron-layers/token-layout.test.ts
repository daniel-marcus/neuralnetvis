import { describe, it, expect } from "vitest"
import { getTokenTexts, layoutTokens, TOKEN_CHAR_W } from "./token-layout"
import type { TokenizerType } from "@/data/tokenizer"

describe("layoutTokens", () => {
  it("sizes the tiles by text length", () => {
    const { tiles } = layoutTokens(["a", "abcd"])
    expect(tiles[1].width - tiles[0].width).toBeCloseTo(3 * TOKEN_CHAR_W)
  })

  it("wraps long lines", () => {
    const { tiles } = layoutTokens(Array.from({ length: 40 }, () => "word"))
    const lines = new Set(tiles.map((t) => t.y))
    expect(lines.size).toBeGreaterThan(1)
    expect(tiles[0].y).toBeGreaterThan(tiles[39].y) // first line on top
  })

  it("breaks the line after a line break token", () => {
    const { tiles } = layoutTokens(["a", "↵", "b"])
    expect(tiles[2].y).toBeLessThan(tiles[1].y)
    expect(tiles[2].x).toBeCloseTo(tiles[0].x)
  })

  it("collapses padding tokens on the last visible token", () => {
    const { tiles } = layoutTokens(["a", "b", "<PAD>", "<PAD>"], 2)
    expect(tiles[3]).toMatchObject({ x: tiles[1].x, y: tiles[1].y, width: 0, isPadding: true })
  })

  it("centers the paragraph", () => {
    const { tiles, width } = layoutTokens(["abc", "abc"])
    expect(tiles[0].x - tiles[0].width / 2).toBeCloseTo(-width / 2)
    expect(tiles[1].x + tiles[1].width / 2).toBeCloseTo(width / 2)
  })
})

describe("getTokenTexts", () => {
  const decoded = [" Once", "\n", "\n\n", " ", "x".repeat(20)]
  const tokenizer = { decode: (t: number) => decoded[t] } as TokenizerType

  it("strips leading spaces, shows line breaks and whitespace, truncates long tokens", () => {
    const texts = getTokenTexts([0, 1, 2, 3, 4], tokenizer)
    expect(texts).toEqual(["Once", "↵", "↵↵", "·", `${"x".repeat(15)}…`])
  })
})
