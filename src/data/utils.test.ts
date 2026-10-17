import { describe, it, expect } from "vitest"
import * as tf from "@tensorflow/tfjs"
import { normalize, normalizeSequence } from "./utils"

describe("normalizeSequence", () => {
  // 2 positions x 1000 features of ±1 with one huge value (as GPT-2 at the first token), 2 padding positions
  const dim = 1000
  const values: number[] = Array.from({ length: 2 * dim }, (_, i) => (i % 2 ? 1 : -1))
  values[0] = 1000
  const padding = Array(2 * dim).fill(5) // e.g. activations for padding tokens: not part of the scale
  const text = tf.tensor3d(values, [1, 2, dim])
  const withPadding = tf.tensor3d([...values, ...padding], [1, 4, dim])

  it("keeps the contrast of the other activations, the outlier saturates", () => {
    const normalized = normalizeSequence(text, 2).dataSync()
    const maxAbs = normalize(text).dataSync() // 1 / 1000
    expect(normalized[0]).toBeCloseTo(1)
    expect(normalized[1]).toBeGreaterThan(10 * maxAbs[1])
  })

  it("scales by the text's positions only", () => {
    const normalized = normalizeSequence(withPadding, 2)
    const textPart = normalized.slice([0, 0], [-1, 2])
    expect(textPart.sub(normalizeSequence(text, 2)).abs().max().dataSync()[0]).toBeLessThan(1e-6)
  })
})
