// builds a safetensors file in memory, see parseSafetensors
// dtype BF16: the upper 16 bits of the float32 values (exact for e.g. 1.5, -0.25), otherwise 4 bytes per value
export function makeSafetensors(
  tensors: Record<string, { shape: number[]; data: number[] | Float32Array; dtype?: string }>,
  headerPadding = 0, // spaces after the JSON header, e.g. to test unaligned data
) {
  let offset = 0
  const header: Record<string, unknown> = { __metadata__: { format: "pt" } }
  for (const [name, { shape, data, dtype = "F32" }] of Object.entries(tensors)) {
    const size = data.length * bytesPerValue(dtype)
    header[name] = { dtype, shape, data_offsets: [offset, offset + size] }
    offset += size
  }
  const headerBytes = new TextEncoder().encode(JSON.stringify(header) + " ".repeat(headerPadding))
  const buffer = new ArrayBuffer(8 + headerBytes.length + offset)
  new DataView(buffer).setBigUint64(0, BigInt(headerBytes.length), true)
  new Uint8Array(buffer, 8).set(headerBytes)
  const view = new DataView(buffer, 8 + headerBytes.length)
  const float32 = new DataView(new ArrayBuffer(4))
  let pos = 0
  for (const { data, dtype = "F32" } of Object.values(tensors)) {
    for (const value of data) {
      if (dtype === "BF16") {
        float32.setFloat32(0, value, true)
        view.setUint16(pos, float32.getUint16(2, true), true)
      } else view.setFloat32(pos, value, true)
      pos += bytesPerValue(dtype)
    }
  }
  return buffer
}

const bytesPerValue = (dtype: string) => (dtype === "BF16" ? 2 : 4)
