import type { SupportedTypedArray } from "./types"

type EncodeDict = { [str: string]: number }
type DecodeDict = { [token: number]: string }

export interface TokenizerType {
  encode(text: string, length?: number): SupportedTypedArray
  decode(token: number): string
  decodeText(tokens: ArrayLike<number>): string // inverse of encode: encode(decodeText(tkns)) === tkns
  encodeDict: EncodeDict
  decodeDict: DecodeDict
  init?: () => Promise<void>
  normalize: (rawText: string) => string
}

class Tokenizer implements TokenizerType {
  encodeDict: EncodeDict = {}
  decodeDict: DecodeDict = {}

  constructor() {
    this.encode = this.encode.bind(this)
    this.decode = this.decode.bind(this)
    this.decodeText = this.decodeText.bind(this)
    this.normalize = this.normalize.bind(this)
  }

  public normalize(rawText: string): string {
    return rawText
  }

  public encode(text: string): SupportedTypedArray {
    const encoded = new Uint8Array(text.length)
    for (let i = 0; i < text.length; i++) {
      encoded[i] = this.encodeDict[text[i]] ?? 0
    }
    return encoded
  }

  public decode(token: number): string {
    return this.decodeDict[token] ?? ""
  }

  public decodeText(tokens: ArrayLike<number>): string {
    return Array.from(tokens, this.decode).join("")
  }

  _reverse(dict: EncodeDict): DecodeDict {
    return Object.fromEntries(Object.entries(dict).map(([k, v]) => [v, k]))
  }
}

class IMDbTokenizer extends Tokenizer {
  async init() {
    const specialTokens = {
      "<PAD>": 0,
      "<START>": 1,
      "<OOV>": 2, // out-of-vocabulary / unknown
    }

    const res = await fetch("/data/imdb/imdb_word_index.json")
    const _dict = (await res.json()) as EncodeDict

    const dict = Object.fromEntries(
      Object.entries(_dict).map(([k, v]) => [k, v + 3]), // offset by 3 for special tokens
    )
    this.encodeDict = { ...specialTokens, ...dict }
    this.decodeDict = this._reverse(this.encodeDict)
  }

  public normalize(rawText: string): string {
    return rawText
      .normalize("NFC") // combine accents, e.g. "e" + "́" -> "é"
      .toLowerCase()
      .replaceAll(/\s+/g, " ") // whitespace incl. line breaks -> single space
      .replaceAll("’", "'") // e.g. "doesn’t" -> "doesn't"
      .replaceAll(/[^\p{L}\p{N} ']/gu, "") // keep letters incl. accents (e.g. "cliché") and digits
      .replaceAll(/\s+/g, " ")
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

  public decodeText(tokens: ArrayLike<number>): string {
    // skip <START> and <PAD> ("start" and "pad" are regular words), <OOV> is normalized to "oov" -> <OOV>
    const { "<START>": start, "<PAD>": pad } = this.encodeDict
    return Array.from(tokens)
      .filter((tkn) => tkn !== start && tkn !== pad)
      .map(this.decode)
      .join(" ")
  }
}

class ShakespeareTokenizer extends Tokenizer {
  private chars = " !$&',-.3:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
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
