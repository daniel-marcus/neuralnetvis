import type { SupportedTypedArray } from "./types"
import type { Tokenizer as HFTokenizer } from "@huggingface/tokenizers"

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

// Hugging Face tokenizers (tokenizer.json format) via Tokenizers.js, loaded only when needed.
// For now GPT-2's byte-level BPE with <|endoftext|> as the start, end and padding token (also as <PAD>,
// <START> and <END>), its id is read from the vocabulary, see ml-notebooks/tinystories.py and gpt2.py
class HuggingFaceTokenizer extends Tokenizer {
  protected path = "" // tokenizer.json
  protected prefix = "" // added before each text, as in the training data
  private hfTokenizer?: HFTokenizer
  private endToken = 0

  async init() {
    const [{ Tokenizer: HFTokenizer }, tokenizerJson] = await Promise.all([
      import("@huggingface/tokenizers"),
      fetch(this.path).then((res) => res.json()),
    ])
    this.hfTokenizer = new HFTokenizer(tokenizerJson, {})
    const vocab = Object.fromEntries(this.hfTokenizer.get_vocab(true)) as EncodeDict
    this.endToken = vocab["<|endoftext|>"]
    const end = this.endToken
    this.encodeDict = { ...vocab, "<PAD>": end, "<START>": end, "<END>": end }
    this.decodeDict = this._reverse(vocab)
  }

  public encode(rawText: string, length?: number): Int32Array {
    const text = this.prefix + this.normalize(rawText)
    const ids = this.hfTokenizer?.encode(text, { add_special_tokens: false }).ids ?? []
    const tokens = [this.endToken, ...ids]
    const encoded = new Int32Array(length ?? tokens.length).fill(this.endToken) // padding
    encoded.set(tokens.slice(0, encoded.length))
    return encoded
  }

  public decode(token: number): string {
    if (token === this.endToken) return this.decodeDict[token]
    return this.decodeIds([token])
  }

  public decodeText(tokens: ArrayLike<number>): string {
    const text = this.decodeIds(Array.from(tokens).filter((t) => t !== this.endToken))
    return text.startsWith(this.prefix) ? text.slice(this.prefix.length) : text // added by encode
  }

  public append(text: string, token: number): string {
    const next = this.decode(token)
    return (next.startsWith(" ") ? text.replace(/ $/, "") : text) + next // no double spaces
  }

  public normalize(rawText: string): string {
    return rawText.replaceAll("\r\n", "\n")
  }

  private decodeIds(ids: number[]): string {
    // no clean up: would remove spaces before punctuation, e.g. " ," -> ","
    return this.hfTokenizer?.decode(ids, { clean_up_tokenization_spaces: false }) ?? ""
  }
}

// TinyStories models (GPT-Neo) with a smaller vocabulary, see ml-notebooks/tinystories.py
// As in the training data, the story starts after a line break: <|endoftext|> \n Once upon a time ...
class TinyStoriesTokenizer extends HuggingFaceTokenizer {
  protected path = "/data/tinystories/tinystories_tokenizer.json"
  protected prefix = "\n"
}

// GPT-2 with the original tokenizer.json (<|endoftext|> = 50256), see ml-notebooks/gpt2.py
class Gpt2Tokenizer extends HuggingFaceTokenizer {
  protected path = "/data/gpt2/gpt2_tokenizer.json"
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
  Gpt2Tokenizer,
  ShakespeareTokenizer,
} as const

export type TokenizerName = keyof typeof tokenizers
