import type * as tf from "@tensorflow/tfjs"
import { mapGpt2 } from "./gpt2"

// Weights of pretrained models from Hugging Face (model.safetensors) instead of weight files in the repo.
// Format: 8 bytes header size (little-endian) + JSON header {name: {dtype, shape, data_offsets}} + data,
// see https://huggingface.co/docs/safetensors

export interface SafeTensor {
  dtype: string
  shape: number[]
  data: Float32Array
}

export type SafeTensors = Record<string, SafeTensor>

interface HeaderEntry {
  dtype: string
  shape: number[]
  data_offsets: [number, number]
}

// tensors are copied: the data in the file is not necessarily 4-byte aligned, and tfjs needs separate buffers.
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
    if (dtype !== "F32") throw new Error(`Unsupported dtype ${dtype} for ${name} (only F32)`)
    const data = new Float32Array(buffer.slice(dataStart + start, dataStart + end))
    tensors[name] = { dtype, shape, data }
  }
  return tensors
}

// maps the tensors of a checkpoint to the weights of the tfjs model, in the order of weightSpecs
export type SafetensorsMapper = {
  skip?: (name: string) => boolean
  map: (tensors: SafeTensors, weightSpecs: tf.io.WeightsManifestEntry[]) => Float32Array[]
}

export const safetensorsMappers = {
  gpt2: mapGpt2,
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
