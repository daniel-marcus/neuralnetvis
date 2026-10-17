import { describe, expect, it } from "vitest"
import { parseSafetensors, writeSafetensors } from "."
import { makeSafetensors } from "./test-utils"

describe("parseSafetensors", () => {
  const tensors = {
    a: { shape: [2, 3], data: [1, 2, 3, 4, 5, 6] },
    b: { shape: [2], data: [-1.5, 0.25] },
  }

  it("should read dtype, shape and data of all tensors", () => {
    const parsed = parseSafetensors(makeSafetensors(tensors))
    expect(Object.keys(parsed)).toEqual(["a", "b"]) // without __metadata__
    expect(parsed.a.shape).toEqual([2, 3])
    expect(Array.from(parsed.a.data)).toEqual([1, 2, 3, 4, 5, 6])
    expect(Array.from(parsed.b.data)).toEqual([-1.5, 0.25])
  })

  it("should read data that is not 4-byte aligned", () => {
    for (const padding of [1, 2, 3]) {
      const parsed = parseSafetensors(makeSafetensors(tensors, padding))
      expect(Array.from(parsed.b.data), `padding ${padding}`).toEqual([-1.5, 0.25])
    }
  })

  it("should skip tensors", () => {
    const parsed = parseSafetensors(makeSafetensors(tensors), (name) => name === "a")
    expect(Object.keys(parsed)).toEqual(["b"])
  })

  it("should read BF16 as float32, also unaligned", () => {
    const data = [1.5, -0.25, 3, 0, -1024, 0.0078125]
    for (const padding of [0, 1]) {
      const parsed = parseSafetensors(
        makeSafetensors({ c: { shape: [2, 3], data, dtype: "BF16" }, ...tensors }, padding),
      )
      expect(parsed.c.dtype).toBe("BF16")
      expect(Array.from(parsed.c.data), `padding ${padding}`).toEqual(data)
      expect(Array.from(parsed.b.data)).toEqual([-1.5, 0.25]) // F32 after BF16
    }
  })

  it("should throw for unsupported dtypes", () => {
    const buffer = makeSafetensors({ c: { shape: [2], data: [1, 2], dtype: "F16" } })
    expect(() => parseSafetensors(buffer)).toThrow("Unsupported dtype F16")
  })
})

describe("writeSafetensors", () => {
  it("should write tensors that parseSafetensors reads, the data 8-byte aligned", () => {
    for (const name of ["a", "ab", "abc", "abcd"]) {
      const tensors = {
        [name]: { shape: [2, 2], data: Float32Array.from([1, 2, 3, 4]) },
        b: { shape: [1], data: Float32Array.from([-0.5]) },
      }
      const buffer = writeSafetensors(tensors)
      const headerSize = Number(new DataView(buffer).getBigUint64(0, true))
      expect((8 + headerSize) % 8).toBe(0)
      const parsed = parseSafetensors(buffer)
      expect(parsed[name].shape).toEqual([2, 2])
      expect(Array.from(parsed[name].data)).toEqual([1, 2, 3, 4])
      expect(Array.from(parsed.b.data)).toEqual([-0.5])
    }
  })

  it("should write only the viewed part of the data", () => {
    const data = Float32Array.from([1, 2, 3, 4]).subarray(1, 3)
    const parsed = parseSafetensors(writeSafetensors({ a: { shape: [2], data } }))
    expect(Array.from(parsed.a.data)).toEqual([2, 3])
  })
})
