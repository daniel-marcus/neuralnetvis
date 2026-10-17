import { describe, it, expect } from "vitest"
import { getTokenTexts, layoutTokens, TOKEN_CHAR_W } from "./token-layout"
import type { TokenizerType } from "@/data/tokenizer"

const texts = (...strings: string[]) => strings.map((text) => ({ text }))

describe("layoutTokens", () => {
  it("sizes the tiles by text length", () => {
    const { tiles } = layoutTokens(texts("a", "abcd"))
    expect(tiles[1].width - tiles[0].width).toBeCloseTo(3 * TOKEN_CHAR_W)
  })

  it("wraps long lines", () => {
    const { tiles } = layoutTokens(Array.from({ length: 40 }, () => ({ text: "word" })))
    const lines = new Set(tiles.map((t) => t.y))
    expect(lines.size).toBeGreaterThan(1)
    expect(tiles[0].y).toBeGreaterThan(tiles[39].y) // first line on top
  })

  it("breaks the line after a line break token", () => {
    const { tiles } = layoutTokens(texts("a", "↵", "b"))
    expect(tiles[2].y).toBeLessThan(tiles[1].y)
    expect(tiles[2].x).toBeCloseTo(tiles[0].x)
  })

  it("collapses padding tokens on the last visible token", () => {
    const { tiles } = layoutTokens(texts("a", "b", "<PAD>", "<PAD>"), 2)
    expect(tiles[3]).toMatchObject({ x: tiles[1].x, y: tiles[1].y, width: 0, isPadding: true })
  })

  it("puts a wider gap before tokens that are separated by a space", () => {
    const { tiles } = layoutTokens([{ text: "a" }, { text: "b" }, { text: "c", isSeparated: true }])
    const gap = (i: number) =>
      tiles[i].x - tiles[i].width / 2 - (tiles[i - 1].x + tiles[i - 1].width / 2)
    expect(gap(1)).toBeGreaterThan(0)
    expect(gap(1)).toBeLessThan(gap(2))
    const wrapped = layoutTokens([
      { text: "a" },
      { text: "↵" },
      { text: "b", isSeparated: true },
    ]).tiles
    expect(wrapped[2].x).toBeCloseTo(wrapped[0].x)
  })

  it("centers the paragraph", () => {
    const { tiles, width } = layoutTokens(texts("abc", "abc"))
    expect(tiles[0].x - tiles[0].width / 2).toBeCloseTo(-width / 2)
    expect(tiles[1].x + tiles[1].width / 2).toBeCloseTo(width / 2)
  })
})

describe("getTokenTexts", () => {
  const decoded = [" Once", "\n", "\n\n", " ", "x".repeat(20), "   if"]
  const tokenizer = {
    decode: (t: number) => decoded[t],
    append: (text: string, t: number) => text + decoded[t], // BPE: the tokens bring their spaces
  } as TokenizerType

  it("keeps leading spaces, shows line breaks and whitespace-only tokens, truncates long tokens", () => {
    const result = getTokenTexts([0, 1, 2, 3, 4, 5], tokenizer)
    expect(result.map((t) => t.text)).toEqual([
      " Once",
      "↵",
      "↵↵",
      "·",
      `${"x".repeat(15)}…`,
      "   if",
    ])
    expect(result.some((t) => t.isSeparated)).toBe(false) // the spaces are part of the tokens
  })

  it("separates the tokens of word tokenizers (spaces between the words)", () => {
    const words = ["<START>", "hello", "world"]
    const wordTokenizer = {
      decode: (t: number) => words[t],
      append: (text: string, t: number) => `${text.trimEnd()} ${words[t]} `.trimStart(),
    } as TokenizerType
    expect(getTokenTexts([1, 2], wordTokenizer)).toEqual([
      { text: "hello", isSeparated: true },
      { text: "world", isSeparated: true },
    ])
  })
})
