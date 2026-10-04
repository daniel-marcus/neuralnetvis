import { describe, it, expect, beforeAll } from "vitest"
import { getSeqPosition } from "./next-token"
import { tokenizers } from "./tokenizer"

describe("getSeqPosition", () => {
  const tokenizer = new tokenizers.TweetsTokenizer()

  beforeAll(async () => {
    await tokenizer.init()
  })

  it("returns the position of the last word", () => {
    expect(getSeqPosition(tokenizer.encode("i love it", 32), tokenizer)).toBe(3)
  })

  it("returns the <START> position for empty input (prediction of the first word)", () => {
    expect(getSeqPosition(tokenizer.encode("", 32), tokenizer)).toBe(0)
  })

  it("ignores the <END> token of dataset samples", () => {
    const { "<START>": start, "<END>": end, "<PAD>": pad, i, love } = tokenizer.encodeDict
    expect(getSeqPosition([start, i, love, end, pad, pad], tokenizer)).toBe(2)
  })
})
