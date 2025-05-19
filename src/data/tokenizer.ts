const vocab = " !$&',-.3:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

export function encode(x: string) {
  const encoded = new Uint8Array(x.length)
  for (let i = 0; i < x.length; i++) {
    const tkn = vocab.indexOf(x[i])
    encoded[i] = tkn
  }
  return encoded
}

export function decodeChar(x: number) {
  return vocab[x]
}
