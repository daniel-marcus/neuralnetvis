type EncodeDict = { [str: string]: number }
type DecodeDict = { [token: number]: string }

export interface TokenizerType {
  encode(text: string): number[] | Uint8Array
  decode(token: number): string
  encodeDict: EncodeDict
  decodeDict: DecodeDict
  init?: () => Promise<void>
}

class Tokenizer implements TokenizerType {
  encodeDict: EncodeDict = {}
  decodeDict: DecodeDict = {}

  constructor() {
    this.encode = this.encode.bind(this)
    this.decode = this.decode.bind(this)
  }

  public encode(x: string): Uint8Array {
    const encoded = new Uint8Array(x.length)
    for (let i = 0; i < x.length; i++) {
      const tkn = this.encodeDict[x] ?? 0
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

    dict["<PAD>"] = 0
    dict["<START>"] = 1
    dict["<UNK>"] = 2

    this.encodeDict = dict
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
