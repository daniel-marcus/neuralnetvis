import { describe, it, expect } from "vitest"
import type { TokenizerType } from "@/data/tokenizer"
import { addTrainData, getTextSamples, resetData, saveTextSamples } from "@/data/dataset"
import { gpt2 } from "@/data/datasets/gpt2"
import type { Dataset } from "@/data/types"
import {
  getBatches,
  getTokenBatches,
  loadTrainingWindows,
  makeWindows,
  sampleToTokens,
  shuffle,
  splitWindows,
  textToTokens,
  toTensors,
} from "./data"

const PAD = 99
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
const toArrays = (windows: ReturnType<typeof makeWindows>) =>
  windows.map(({ x, y, mask }) => ({ x: [...x], y: [...y], mask: [...mask] }))

// <|endoftext|> as <START>, <END> and <PAD> as in GPT-2
const END = 0
const fakeTokenizer = {
  encodeDict: { "<START>": END, "<END>": END, "<PAD>": END },
} as unknown as TokenizerType

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

describe("getTokenBatches", () => {
  // windows with n targets (seqLen 8)
  const w = (n: number) => makeWindows(range(n + 1), 8, PAD)[0]
  const lengths = (batches: ReturnType<typeof getTokenBatches>) =>
    batches.map((b) => b.map((win) => win.mask.reduce((a, c) => a + c, 0)))

  it("limits the windows and the positions (windows x longest window) per batch", () => {
    const windows = [w(2), w(2), w(3), w(8), w(1), w(1), w(1)]
    expect(lengths(getTokenBatches(windows, 4, 8))).toEqual([[2, 2], [3], [8], [1, 1, 1]])
    expect(lengths(getTokenBatches(windows, 2))).toEqual([[2, 2], [3, 8], [1, 1], [1]])
  })

  it("puts a window longer than maxTokens in its own batch", () => {
    expect(lengths(getTokenBatches([w(1), w(8), w(1)], 4, 4))).toEqual([[1], [8], [1]])
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

  it("trims the batch to its longest window", () => {
    const windows = [...makeWindows([1, 2, 3], 6, PAD), ...makeWindows([4, 5, 6, 7], 6, PAD)]
    const { xs, ys, mask } = toTensors(windows)
    expect(xs.arraySync()).toEqual([
      [1, 2, PAD],
      [4, 5, 6],
    ])
    expect(ys.arraySync()).toEqual([2, 3, PAD, 5, 6, 7])
    expect(mask.arraySync()).toEqual([1, 1, 0, 1, 1, 1])
  })
})

describe("samples as training data", () => {
  it("takes the text tokens of a sample and adds <END>, except for full samples (continued)", () => {
    expect([...sampleToTokens([END, 5, 6, 7, END, END], fakeTokenizer)]).toEqual([
      END,
      5,
      6,
      7,
      END,
    ])
    expect([...sampleToTokens([END, 5, 6, 7], fakeTokenizer)]).toEqual([END, 5, 6, 7]) // full
  })

  it("loads one window per stored sample", async () => {
    const ds = { ...gpt2, key: "lora_windows_test", inputDims: [4], storeBatchSize: 2 } as Dataset
    await resetData(ds.key, "train")
    const samples = [
      [END, 5, END, END],
      [END, 6, 7, 8],
      [END, 9, 10, END],
    ]
    const meta = await addTrainData(
      ds,
      { data: Int32Array.from(samples.flat()), shape: [3, 4] },
      {
        data: new Int32Array(12),
        shape: [3, 4],
      },
    )
    const windows = await loadTrainingWindows({ ...ds, train: meta, tokenizer: fakeTokenizer })
    expect(toArrays(windows)).toEqual([
      { x: [END, 5, END, END], y: [5, END, END, END], mask: [1, 1, 0, 0] },
      // full: continued by the next sample, no <END> (8: the last token has no target, no input)
      { x: [END, 6, 7, END], y: [6, 7, 8, END], mask: [1, 1, 1, 0] },
      { x: [END, 9, 10, END], y: [9, 10, END, END], mask: [1, 1, 1, 0] },
    ])
  })

  it("splits long texts into samples that give the same targets as one long text, <END> only at the end", async () => {
    // chars as tokens (a = 1, b = 2, ...), <START> = <END> = <PAD> = 0 as in GPT-2
    const tokenizer = {
      ...fakeTokenizer,
      encode: (text: string) =>
        Int32Array.from([END, ...[...text].map((c) => c.charCodeAt(0) - 96)]),
    } as unknown as TokenizerType
    const ds = {
      ...gpt2,
      key: "lora_split_test",
      inputDims: [4],
      storeBatchSize: 2,
      tokenizer,
    } as Dataset
    await resetData(ds.key, "train")
    const samples = getTextSamples(ds, [
      { text: "abcdefg", name: "long.txt" },
      { text: " \n " }, // empty: skipped
      { text: "ab" },
    ])
    expect(samples.map((s) => [[...s.X], s.name])).toEqual([
      [[END, 1, 2, 3], "long.txt (1/3)"],
      [[3, 4, 5, 6], "long.txt (2/3)"], // starts with the last token of the previous sample
      [[6, 7, END, END], "long.txt (3/3)"],
      [[END, 1, 2, END], ""],
    ])
    const meta = await saveTextSamples(ds, samples)
    const windows = await loadTrainingWindows({ ...ds, train: meta })
    const targets = (w: (typeof windows)[number]) => [...w.y].filter((_, i) => w.mask[i])
    expect(windows.map(targets)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, END],
      [1, 2, END],
    ])
  })
})
