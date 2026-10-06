// builds a safetensors file in memory, see parseSafetensors
export function makeSafetensors(
  tensors: Record<string, { shape: number[]; data: number[] | Float32Array; dtype?: string }>,
  headerPadding = 0, // spaces after the JSON header, e.g. to test unaligned data
) {
  let offset = 0
  const header: Record<string, unknown> = { __metadata__: { format: "pt" } }
  for (const [name, { shape, data, dtype = "F32" }] of Object.entries(tensors)) {
    header[name] = { dtype, shape, data_offsets: [offset, offset + data.length * 4] }
    offset += data.length * 4
  }
  const headerBytes = new TextEncoder().encode(JSON.stringify(header) + " ".repeat(headerPadding))
  const buffer = new ArrayBuffer(8 + headerBytes.length + offset)
  new DataView(buffer).setBigUint64(0, BigInt(headerBytes.length), true)
  new Uint8Array(buffer, 8).set(headerBytes)
  const view = new DataView(buffer, 8 + headerBytes.length)
  let pos = 0
  for (const { data } of Object.values(tensors)) {
    for (const value of data) {
      view.setFloat32(pos, value, true)
      pos += 4
    }
  }
  return buffer
}
