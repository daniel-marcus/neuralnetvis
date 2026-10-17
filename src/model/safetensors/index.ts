import type * as tf from "@tensorflow/tfjs"
import { mapGpt2 } from "./gpt2"
import { mapLfm2 } from "./lfm2"

// Weights of pretrained models from Hugging Face (model.safetensors) instead of weight files in the repo.
// Format: 8 bytes header size (little-endian) + JSON header {name: {dtype, shape, data_offsets}} + data,
// see https://huggingface.co/docs/safetensors

export interface SafeTensor {
  dtype: string
  shape: number[]
  data: Float32Array // parsed tensors: decoded on each access, see parseSafetensors
}

export type SafeTensors = Record<string, SafeTensor>

interface HeaderEntry {
  dtype: string
  shape: number[]
  data_offsets: [number, number]
}

// F32 or BF16 (e.g. LFM2.5), both as float32.
// The data is decoded on each access of tensor.data (not kept): large checkpoints are not held in memory twice
// while they are mapped to the model's weights, e.g. LFM2.5: 0.7 GB BF16 -> 1.4 GB float32 (+ transposed copies).
// Tensors are copies: the data in the file is not necessarily 4-byte aligned, and tfjs needs separate buffers.
// skip: names of tensors that are not needed (e.g. attention masks)
export function parseSafetensors(buffer: ArrayBuffer, skip?: (name: string) => boolean) {
  const headerSize = Number(new DataView(buffer).getBigUint64(0, true))
  const headerBytes = new Uint8Array(buffer, 8, headerSize)
  const { __metadata__: _, ...header } = JSON.parse(
    new TextDecoder().decode(headerBytes),
  ) as Record<string, HeaderEntry>
  const dataStart = 8 + headerSize
  const tensors: SafeTensors = {}
  for (const [
    name,
    {
      dtype,
      shape,
      data_offsets: [start, end],
    },
  ] of Object.entries(header)) {
    if (skip?.(name)) continue
    const decode = decoders[dtype]
    if (!decode) throw new Error(`Unsupported dtype ${dtype} for ${name} (only F32, BF16)`)
    const [from, to] = [dataStart + start, dataStart + end]
    tensors[name] = {
      dtype,
      shape,
      get data() {
        return decode(buffer.slice(from, to))
      },
    }
  }
  return tensors
}

const decoders: Record<string, (bytes: ArrayBuffer) => Float32Array> = {
  F32: (bytes) => new Float32Array(bytes),
  // bfloat16 = the upper 16 bits of a float32 (same sign and exponent, shorter mantissa): exact conversion
  BF16: (bytes) => {
    const bf16 = new Uint16Array(bytes)
    const bits = new Uint32Array(bf16.length)
    for (let i = 0; i < bf16.length; i++) bits[i] = bf16[i] << 16
    return new Float32Array(bits.buffer)
  },
}

// F32 only (parseSafetensors also reads BF16), metadata values must be strings. The header is padded with
// spaces so that the data starts 8-byte aligned (as in the reference implementation), the data is copied as it
// is in memory (little-endian on all relevant platforms)
export function writeSafetensors(
  tensors: Record<string, Pick<SafeTensor, "shape" | "data">>,
  metadata: Record<string, string> = { format: "pt" },
) {
  const header: Record<string, unknown> = { __metadata__: metadata }
  let offset = 0
  for (const [name, { shape, data }] of Object.entries(tensors)) {
    header[name] = { dtype: "F32", shape, data_offsets: [offset, offset + data.byteLength] }
    offset += data.byteLength
  }
  const json = new TextEncoder().encode(JSON.stringify(header))
  const headerSize = Math.ceil(json.length / 8) * 8
  const buffer = new ArrayBuffer(8 + headerSize + offset)
  new DataView(buffer).setBigUint64(0, BigInt(headerSize), true)
  const bytes = new Uint8Array(buffer)
  bytes.fill(0x20, 8, 8 + headerSize)
  bytes.set(json, 8)
  let pos = 8 + headerSize
  for (const { data } of Object.values(tensors)) {
    bytes.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), pos)
    pos += data.byteLength
  }
  return buffer
}

// maps the tensors of a checkpoint to the weights of the tfjs model, in the order of weightSpecs
export type SafetensorsMapper = {
  skip?: (name: string) => boolean
  map: (tensors: SafeTensors, weightSpecs: tf.io.WeightsManifestEntry[]) => Float32Array[]
}

export const safetensorsMappers = {
  gpt2: mapGpt2,
  lfm2: mapLfm2,
} satisfies Record<string, SafetensorsMapper>

export type SafetensorsMapperName = keyof typeof safetensorsMappers

export function getWeightsFromSafetensors(
  buffer: ArrayBuffer,
  weightSpecs: tf.io.WeightsManifestEntry[],
  mapperName: SafetensorsMapperName,
) {
  const mapper: SafetensorsMapper = safetensorsMappers[mapperName]
  const weights = mapper.map(parseSafetensors(buffer, mapper.skip), weightSpecs)
  if (weights.length !== weightSpecs.length) {
    throw new Error(`Expected ${weightSpecs.length} weights, got ${weights.length}`)
  }
  for (const [i, spec] of weightSpecs.entries()) {
    const size = spec.shape.reduce((a, b) => a * b, 1)
    if (weights[i].length !== size) {
      throw new Error(
        `${spec.name}: expected ${size} values [${spec.shape}], got ${weights[i].length}`,
      )
    }
  }
  // one buffer per weight, concatenated by tfjs in the order of weightSpecs
  return weights.map((w) =>
    w.byteOffset === 0 && w.byteLength === w.buffer.byteLength ? w.buffer : w.slice().buffer,
  ) as ArrayBuffer[]
}
