import { describe, it, expect } from "vitest"
import { getNeuronIdxAt, getNeuronPos } from "./layout"
import type { LayerPos } from "./types"

describe("getNeuronIdxAt", () => {
  const spacedSize = 0.2
  const cases: [LayerPos, number, number, number][] = [
    ["hidden", 5, 4, 1],
    ["hidden", 6, 7, 5], // channels in a grid of 3x2 cells
    ["hidden", 10, 1, 1], // 1D to 2D grid
    ["output", 60, 1, 1], // columns
    ["input", 8, 8, 1],
  ]

  it.each(cases)("is the inverse of getNeuronPos (%s %ix%ix%i)", (layerPos, h, w, c) => {
    for (let i = 0; i < h * w * c; i++) {
      const [, y, z] = getNeuronPos(i, layerPos, h, w, c, spacedSize)
      expect(getNeuronIdxAt(y, z, layerPos, h, w, c, spacedSize)).toBe(i)
      // anywhere within the cell of the neuron
      const offset = spacedSize * 0.4
      expect(getNeuronIdxAt(y + offset, z - offset, layerPos, h, w, c, spacedSize)).toBe(i)
    }
  })

  it("returns undefined outside of the layer and between channels", () => {
    expect(getNeuronIdxAt(100, 0, "hidden", 5, 4, 1, spacedSize)).toBeUndefined()
    expect(getNeuronIdxAt(0, -100, "hidden", 5, 4, 1, spacedSize)).toBeUndefined()
    // gap between the first 2 channel cells: 1 neuron wide, right of the last column
    const [, y, z] = getNeuronPos(3 * 5, "hidden", 6, 7, 5, spacedSize) // row 0, col 3, channel 0
    const gapZ = z + 4 * spacedSize
    expect(getNeuronIdxAt(y, gapZ, "hidden", 6, 7, 5, spacedSize)).toBeUndefined()
  })
})
