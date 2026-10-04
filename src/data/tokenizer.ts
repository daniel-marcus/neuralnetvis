import type { SupportedTypedArray } from "./types"

type EncodeDict = { [str: string]: number }
type DecodeDict = { [token: number]: string }

export interface TokenizerType {
  encode(text: string, length?: number): SupportedTypedArray
  decode(token: number): string
  decodeText(tokens: ArrayLike<number>): string // inverse of encode: encode(decodeText(tkns)) === tkns
  append(text: string, token: number): string // text + token, e.g. a suggested next word
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
    this.append = this.append.bind(this)
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

  public append(text: string, token: number): string {
    return text + this.decode(token)
  }

  _reverse(dict: EncodeDict): DecodeDict {
    return Object.fromEntries(Object.entries(dict).map(([k, v]) => [v, k]))
  }
}

// word-level tokenizers: <START> + words (+ <PAD>...), special tokens are identified by id because
// their names are regular words too (e.g. "start", "pad", "end", "oov")
class WordTokenizer extends Tokenizer {
  public encode(rawText: string, _length?: number): Int32Array {
    const text = this.normalize(rawText)
    const words = text ? text.split(" ") : []
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
    // skip <START>, <PAD> and <END> (if any), <OOV> is normalized to "oov" -> <OOV> or the word "oov"
    const { "<START>": start, "<PAD>": pad, "<END>": end } = this.encodeDict
    return Array.from(tokens)
      .filter((tkn) => tkn !== start && tkn !== pad && tkn !== end)
      .map(this.decode)
      .join(" ")
  }

  public append(text: string, token: number): string {
    return `${text.trimEnd()} ${this.decode(token)} `.trimStart()
  }
}

class IMDbTokenizer extends WordTokenizer {
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
}

class TweetsTokenizer extends WordTokenizer {
  async init() {
    // word -> token id, incl. special tokens: <PAD> 0, <START> 1, <OOV> 2, <END> 3
    const res = await fetch("/data/tweets/tweets_word_index.json")
    this.encodeDict = (await res.json()) as EncodeDict
    this.decodeDict = this._reverse(this.encodeDict)
  }

  public normalize(rawText: string): string {
    // same as normalize() in ml-notebooks/tweets.py
    return rawText
      .replaceAll(/https?:\/\/\S+|www\.\S+|@\w+/g, " ") // drop links and mentions
      .toLowerCase()
      .replaceAll("’", "'") // e.g. "don’t" -> "don't"
      .replaceAll(/[^a-z0-9' ]/g, " ") // keep letters, digits and apostrophes
      .replaceAll(/\s+/g, " ")
      .trim()
  }
}

// GPT-2 byte-level BPE: the tokens are strings of bytes, each byte mapped to a printable character
// (e.g. " " -> "Ġ", "\n" -> "Ċ"), see bytes_to_unicode in https://github.com/openai/gpt-2/blob/master/src/encoder.py
const isPrintableByte = (b: number) =>
  (b >= 33 && b <= 126) || (b >= 161 && b <= 172) || (b >= 174 && b <= 255)
const BYTE_TO_CHAR = (() => {
  let n = 0
  return Array.from({ length: 256 }, (_, b) =>
    String.fromCharCode(isPrintableByte(b) ? b : 256 + n++),
  )
})()
const CHAR_TO_BYTE = new Map(BYTE_TO_CHAR.map((char, b) => [char, b]))
// GPT-2's pre-tokenizer: BPE merges only within these pieces (words with leading space, numbers, ...)
const PRE_TOKENIZE = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu

// TinyStories models (GPT-Neo) with a smaller vocabulary, see ml-notebooks/tinystories.py
// <|endoftext|> (id 0) is the start, end and padding token, also as <PAD>, <START> and <END>.
// As in the training data, the story starts after a line break: <|endoftext|> \n Once upon a time ...
class TinyStoriesTokenizer extends Tokenizer {
  private vocab: EncodeDict = {} // byte-level token -> id
  private mergeRanks = new Map<string, number>() // "a b" -> priority (lower: merged first)
  private cache = new Map<string, number[]>() // pre-tokenized piece -> token ids
  private endToken = 0

  async init() {
    // Hugging Face tokenizer.json format
    const res = await fetch("/data/tinystories/tinystories_tokenizer.json")
    const { model } = (await res.json()) as { model: { vocab: EncodeDict; merges: string[] } }
    this.vocab = model.vocab
    this.mergeRanks = new Map(model.merges.map((merge, rank) => [merge, rank]))
    this.endToken = model.vocab["<|endoftext|>"]
    const end = this.endToken
    this.encodeDict = { ...model.vocab, "<PAD>": end, "<START>": end, "<END>": end }
    this.decodeDict = this._reverse(model.vocab)
  }

  public encode(rawText: string, length?: number): Int32Array {
    const text = "\n" + this.normalize(rawText)
    const pieces = text.match(PRE_TOKENIZE) ?? []
    const tokens = [this.endToken, ...pieces.flatMap((piece) => this.bpe(piece))]
    const encoded = new Int32Array(length ?? tokens.length).fill(this.endToken) // padding
    encoded.set(tokens.slice(0, encoded.length))
    return encoded
  }

  public decode(token: number): string {
    if (token === this.endToken) return this.decodeDict[token]
    return this.decodeBytes([token])
  }

  public decodeText(tokens: ArrayLike<number>): string {
    const text = this.decodeBytes(Array.from(tokens).filter((t) => t !== this.endToken))
    return text.replace(/^\n/, "") // added by encode
  }

  public append(text: string, token: number): string {
    const next = this.decode(token)
    return (next.startsWith(" ") ? text.replace(/ $/, "") : text) + next // no double spaces
  }

  public normalize(rawText: string): string {
    return rawText.replaceAll("\r\n", "\n")
  }

  private bpe(piece: string): number[] {
    const cached = this.cache.get(piece)
    if (cached) return cached
    let parts = Array.from(new TextEncoder().encode(piece), (b) => BYTE_TO_CHAR[b])
    // merge the adjacent pair with the highest priority until no more merges apply
    while (parts.length > 1) {
      let best = -1
      let bestRank = Infinity
      for (let i = 0; i < parts.length - 1; i++) {
        const rank = this.mergeRanks.get(`${parts[i]} ${parts[i + 1]}`)
        if (rank !== undefined && rank < bestRank) [best, bestRank] = [i, rank]
      }
      if (best < 0) break
      parts = [...parts.slice(0, best), parts[best] + parts[best + 1], ...parts.slice(best + 2)]
    }
    const ids = parts.map((part) => this.vocab[part]) // single bytes are always in the vocabulary
    this.cache.set(piece, ids)
    return ids
  }

  private decodeBytes(tokens: number[]): string {
    const bytes = tokens.flatMap((t) =>
      Array.from(this.decodeDict[t] ?? "", (char) => CHAR_TO_BYTE.get(char) ?? 0),
    )
    return new TextDecoder().decode(new Uint8Array(bytes))
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
  TweetsTokenizer,
  TinyStoriesTokenizer,
  ShakespeareTokenizer,
} as const

export type TokenizerName = keyof typeof tokenizers
