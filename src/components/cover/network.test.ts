import { describe, expect, it } from "vitest"
import { createNetwork } from "./network"

const config = { layers: 8, neurons: 31, fan: 2, sampleInterval: 0.6, signalDuration: 0.18 }

// mulberry32
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("createNetwork", () => {
  it("changes neurons behind the input layer only when a signal arrives", () => {
    const network = createNetwork({ ...config, random: seededRandom(1) })
    const { layers, fanSize } = network
    let numChanges = 0
    let prevTime = 0
    for (let time = 0.01; time < 20; time += 0.01) {
      network.update(time)
      for (let slot = 2; slot < layers.length; slot++) {
        const src = layers[slot - 1]
        layers[slot].changedAt.forEach((changedAt, to) => {
          if (changedAt <= prevTime) return
          numChanges++
          const sentAt = Array.from({ length: fanSize }, (_, c) => {
            const from = to + config.fan - c
            return from >= 0 && from < config.neurons ? src.sentAt[from * fanSize + c] : -Infinity
          })
          expect(sentAt.some((t) => Math.abs(t + config.signalDuration - changedAt) < 1e-3)).toBe(
            true,
          )
        })
      }
      prevTime = time
    }
    expect(numChanges).toBeGreaterThan(100)
  })

  it("keeps a part of the neurons active in all layers", () => {
    const network = createNetwork({ ...config, neurons: 73, random: seededRandom(2) })
    for (let time = 0.05; time < 60; time += 0.05) {
      network.update(time)
      if (Math.round(time * 20) % 30 === 0) network.shift()
    }
    for (const layer of network.layers) {
      const share = layer.values.filter((v) => Math.abs(v) > 0.1).length / layer.values.length
      expect(share).toBeGreaterThan(0.1)
      expect(share).toBeLessThan(0.7)
    }
  })
})
