import { describe, it, expect, beforeAll } from "vitest"
import { getSeqPosition, sampleNextToken } from "./next-token"
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

describe("sampleNextToken", () => {
  const probs = [0.1, 0.6, 0.3]

  it("samples proportional to the probabilities", () => {
    // cumulative: [0.1, 0.7, 1.0] with temperature 1
    expect(sampleNextToken(probs, { temperature: 1, random: () => 0.05 })).toBe(0)
    expect(sampleNextToken(probs, { temperature: 1, random: () => 0.5 })).toBe(1)
    expect(sampleNextToken(probs, { temperature: 1, random: () => 0.95 })).toBe(2)
  })

  it("never samples excluded tokens", () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const token = sampleNextToken(probs, { excludedTokens: [1], random: () => r })
      expect(token).not.toBe(1)
    }
  })

  it("prefers likely tokens with low temperature", () => {
    // 0.6^10 / (0.1^10 + 0.6^10 + 0.3^10) > 0.99
    expect(sampleNextToken(probs, { temperature: 0.1, random: () => 0.98 })).toBe(1)
  })
})
