type EncodeDict = { [str: string]: number }
type DecodeDict = { [token: number]: string }

export interface TokenizerType {
  encode(text: string, length?: number): number[] | Int32Array
  decode(token: number): string
  encodeDict: EncodeDict
  decodeDict: DecodeDict
  init?: () => Promise<void>
  normalize: (rawText: string) => string
}

class Tokenizer implements TokenizerType {
  encodeDict: EncodeDict = {
    "<PAD>": 0,
    "<START>": 1,
    "<OOV>": 2, // out-of-vocabulary / unknown
  }
  decodeDict: DecodeDict = {}

  constructor() {
    this.encode = this.encode.bind(this)
    this.decode = this.decode.bind(this)
    this.normalize = this.normalize.bind(this)
  }

  public normalize(rawText: string): string {
    return rawText
      .toLowerCase()
      .replaceAll(/[^a-z0-9 ']/g, "")
      .replaceAll(/\s+/g, " ") // replace multiple spaces with single space
      .trim()
  }

  public encode(rawText: string, _length?: number): Int32Array {
    const text = this.normalize(rawText)
    const words = text.split(" ")
    const length = _length ?? words.length + 1 // +1 for <START> token
    const encoded = new Int32Array(length)
    encoded[0] = this.encodeDict["<START>"]
    for (let i = 1; i < length; i++) {
      let tkn: number
      const wordIdx = i - 1
      if (wordIdx >= words.length) tkn = this.encodeDict["<PAD>"]
      else tkn = this.encodeDict[words[wordIdx]] ?? this.encodeDict["<OOV>"]
      encoded[i] = tkn
    }
    return encoded
  }

  public decode(token: number): string {
    return this.decodeDict[token] ?? ""
  }

  _reverse(dict: EncodeDict): DecodeDict {
    return Object.fromEntries(Object.entries(dict).map(([k, v]) => [v, k]))
  }
}

class IMDbTokenizer extends Tokenizer {
  async init() {
    const res = await fetch("/data/imdb/imdb_word_index.json")
    const _dict = (await res.json()) as EncodeDict

    const dict = Object.fromEntries(
      Object.entries(_dict).map(([k, v]) => [k, v + 3]) // offset by 3 for special tokens
    )

    this.encodeDict = { ...this.encodeDict, ...dict }
    this.decodeDict = this._reverse(this.encodeDict)
  }
}

class ShakespeareTokenizer extends Tokenizer {
  private chars =
    " !$&',-.3:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
  constructor() {
    super()
    this.chars.split("").forEach((char, idx) => {
      this.encodeDict[char] = idx
      this.decodeDict[idx] = char
    })
  }
}

export const tokenizers = {
  IMDbTokenizer,
  ShakespeareTokenizer,
} as const

export type TokenizerName = keyof typeof tokenizers
