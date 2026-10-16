import { describe, it, expect } from "vitest"
import type { TokenizerType } from "@/data/tokenizer"
import { getBatches, makeWindows, shuffle, splitWindows, textToTokens, toTensors } from "./data"

const PAD = 99
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const toArrays = (windows: ReturnType<typeof makeWindows>) =>
  windows.map(({ x, y, mask }) => ({ x: [...x], y: [...y], mask: [...mask] }))

describe("textToTokens", () => {
  it("adds <END> after the encoded text", () => {
    const tokenizer = {
      encode: (text: string) => Int32Array.from([0, ...text.split("").map((c) => c.charCodeAt(0))]),
      encodeDict: { "<END>": 0 },
    } as unknown as TokenizerType
    expect([...textToTokens("ab", tokenizer)]).toEqual([0, 97, 98, 0])
  })
})

describe("makeWindows", () => {
  it("splits into windows of seqLen + 1 tokens with a stride of seqLen, the last one padded", () => {
    expect(toArrays(makeWindows(range(10), 4, PAD))).toEqual([
      { x: [0, 1, 2, 3], y: [1, 2, 3, 4], mask: [1, 1, 1, 1] },
      { x: [4, 5, 6, 7], y: [5, 6, 7, 8], mask: [1, 1, 1, 1] },
      { x: [8, PAD, PAD, PAD], y: [9, PAD, PAD, PAD], mask: [1, 0, 0, 0] },
    ])
  })

  it("gives a single window for seqLen + 1 tokens or less", () => {
    expect(toArrays(makeWindows(range(5), 4, PAD))).toEqual([
      { x: [0, 1, 2, 3], y: [1, 2, 3, 4], mask: [1, 1, 1, 1] },
    ])
    expect(toArrays(makeWindows(range(3), 4, PAD))).toEqual([
      { x: [0, 1, PAD, PAD], y: [1, 2, PAD, PAD], mask: [1, 1, 0, 0] },
    ])
    expect(makeWindows(range(1), 4, PAD)).toEqual([]) // no target
  })

  it("has each token (except the first) as an unmasked target exactly once", () => {
    for (const n of [2, 7, 8, 9, 50]) {
      const targets = makeWindows(range(n), 8, PAD).flatMap(({ y, mask }) =>
        [...y].filter((_, i) => mask[i]),
      )
      expect(targets).toEqual(range(n).slice(1))
    }
  })
})

describe("splitWindows", () => {
  it("uses the last windows for validation, none if less than one", () => {
    const windows = makeWindows(range(41), 4, PAD) // 10 windows
    expect(splitWindows(windows, 0.1).validation).toEqual(windows.slice(9))
    expect(splitWindows(windows, 0.25).train).toEqual(windows.slice(0, 8))
    expect(splitWindows(windows.slice(0, 9), 0.1).validation).toEqual([])
  })
})

describe("shuffle, getBatches, toTensors", () => {
  it("shuffles a copy", () => {
    const items = range(10)
    const shuffled = shuffle(items, () => 0)
    expect(shuffled).not.toEqual(items)
    expect(shuffled.toSorted((a, b) => a - b)).toEqual(items)
    expect(items).toEqual(range(10))
  })

  it("splits into batches, the last one smaller", () => {
    expect(getBatches(range(5), 2)).toEqual([[0, 1], [2, 3], [4]])
  })

  it("creates the batch tensors", () => {
    const windows = makeWindows(range(10), 4, PAD)
    const { xs, ys, mask } = toTensors(windows)
    expect(xs.shape).toEqual([3, 4])
    expect(xs.dtype).toBe("int32")
    expect(ys.dtype).toBe("int32")
    expect(xs.arraySync()).toEqual(windows.map((w) => [...w.x]))
    expect(ys.arraySync()).toEqual(windows.flatMap((w) => [...w.y]))
    expect(mask.arraySync()).toEqual(windows.flatMap((w) => [...w.mask]))
  })
})
