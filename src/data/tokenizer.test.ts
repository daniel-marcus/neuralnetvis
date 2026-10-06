import { describe, it, expect, beforeAll } from "vitest"
import { tokenizers } from "./tokenizer"
import { fetchMultipleNpzWithProgress } from "./npy-loader"

describe("IMDBTokenizer", () => {
  const tokenizer = new tokenizers.IMDbTokenizer()

  beforeAll(async () => {
    await tokenizer.init()
  })

  // some words in the Keras word index contain Windows-1252 artifacts (e.g. "very" with a
  // leading U+0091) that normalize() strips, so samples with such tokens don't round-trip exactly
  const isStable = (tkn: number) => {
    const word = tokenizer.decode(tkn)
    return word.startsWith("<") || tokenizer.normalize(word) === word
  }

  it("should normalize text (trim, lowercase, and remove non-alpha-numeric chars)", () => {
    const rawText = " Hello, World! 123%%., "
    const normalized = tokenizer.normalize(rawText)
    expect(normalized).toBe("hello world 123")
  })

  it("encode should add <START> token and pad text to specified length", () => {
    const rawText = "Hello World"
    const length = 10
    const encoded = tokenizer.encode(rawText, length)
    expect(encoded.length).toBe(length)
    expect(encoded[0]).toBe(tokenizer.encodeDict["<START>"])
    expect(encoded.slice(3).every((tkn) => tkn === tokenizer.encodeDict["<PAD>"])).toBe(true)
  })

  it("encode->decode should return (normalized) input w/ <OOV>", () => {
    const rawText = "Wtf is this outofvocabulary"
    const encoded = tokenizer.encode(rawText, 5)
    const decoded = [...encoded].slice(1).map((tkn) => tokenizer.decode(tkn))
    const decodedStr = decoded.join(" ")
    expect(decodedStr).toEqual("wtf is this <OOV>")
  })

  it("decodeText should skip special tokens and keep <OOV>", () => {
    const encoded = tokenizer.encode("Wtf is this outofvocabulary", 10)
    expect(tokenizer.decodeText(encoded)).toEqual("wtf is this <OOV>")
  })

  it("should keep accents, apostrophes and word boundaries at line breaks", () => {
    expect(tokenizer.normalize("Naïve CLICHÉ\nmovie, doesn’t it?")).toBe(
      "naïve cliché movie doesn't it",
    )
    const combiningAcute = String.fromCodePoint(0x301)
    expect(tokenizer.normalize(`cliche${combiningAcute}`)).toBe("cliché")
  })

  it("encode(decodeText(tokens)) should return the same tokens (dataset samples)", async () => {
    const [xTrain] = await fetchMultipleNpzWithProgress(["/data/imdb/x_train_preview.npz"], true)
    const [numSamples, length] = xTrain.shape
    let checked = 0
    for (let i = 0; i < numSamples; i++) {
      const tokens = Array.from(xTrain.data.slice(i * length, (i + 1) * length), Number)
      if (!tokens.every(isStable)) continue
      const reEncoded = tokenizer.encode(tokenizer.decodeText(tokens), length)
      expect(Array.from(reEncoded), `sample ${i}`).toEqual(tokens)
      checked++
    }
    expect(checked).toBeGreaterThan(numSamples * 0.9)
  })
})

describe("TweetsTokenizer", () => {
  const tokenizer = new tokenizers.TweetsTokenizer()

  beforeAll(async () => {
    await tokenizer.init()
  })

  it("should normalize text like tweets.py (drop links and mentions, keep apostrophes)", () => {
    const rawText = "@User Can’t WAIT!!! 2day :) http://t.co/abc www.example.com #fun"
    expect(tokenizer.normalize(rawText)).toBe("can't wait 2day fun")
  })

  it("encode should add <START> token and pad text to specified length", () => {
    const encoded = tokenizer.encode("i love it", 8)
    expect(encoded.length).toBe(8)
    expect(encoded[0]).toBe(tokenizer.encodeDict["<START>"])
    expect(Array.from(encoded.slice(1, 4), tokenizer.decode)).toEqual(["i", "love", "it"])
    expect(encoded.slice(4).every((tkn) => tkn === tokenizer.encodeDict["<PAD>"])).toBe(true)
  })

  it("encode empty text to <START> only (prediction of the first word)", () => {
    expect(Array.from(tokenizer.encode(""))).toEqual([tokenizer.encodeDict["<START>"]])
  })

  it("decodeText should skip <START>, <PAD> and <END> but keep words with the same names", () => {
    const { "<START>": start, "<END>": end, "<PAD>": pad, start: startWord } = tokenizer.encodeDict
    expect(tokenizer.decodeText([start, startWord, end, pad])).toEqual("start")
    expect(tokenizer.decodeText(tokenizer.encode("i love outofvocabulary"))).toEqual("i love <OOV>")
  })

  it("encode(decodeText(tokens)) should return the same tokens (dataset samples)", async () => {
    const [xTrain] = await fetchMultipleNpzWithProgress(["/data/tweets/x_train_preview.npz"], true)
    const [numSamples, length] = xTrain.shape
    const { "<END>": end, "<PAD>": pad } = tokenizer.encodeDict
    for (let i = 0; i < numSamples; i++) {
      const tokens = Array.from(xTrain.data.slice(i * length, (i + 1) * length), Number)
      const reEncoded = tokenizer.encode(tokenizer.decodeText(tokens), length)
      // user input has no <END> token (the model predicts it)
      const expected = tokens.map((tkn) => (tkn === end ? pad : tkn))
      expect(Array.from(reEncoded), `sample ${i}`).toEqual(expected)
    }
  })
})

describe("TinyStoriesTokenizer", () => {
  const tokenizer = new tokenizers.TinyStoriesTokenizer()

  beforeAll(async () => {
    await tokenizer.init()
  })

  it("encode should give the same tokens as the Hugging Face tokenizer in tinystories.py", () => {
    // [0] + tokenizer.encode("\n" + text).ids
    const expected = {
      "Once upon a time, there was a little girl named Lily.": [
        0, 199, 4649, 2082, 258, 637, 12, 610, 373, 258, 1253, 2197, 2921, 7619, 14,
      ],
      'She said, "I\'m happy!"\n\nThe end.': [
        0, 199, 2699, 530, 12, 366, 41, 1067, 2959, 2126, 199, 199, 464, 869, 14,
      ],
      // rare words are split into smaller tokens, down to single bytes
      "Supercalifragilistic 123 café": [
        0, 199, 3890, 524, 67, 283, 361, 82, 363, 347, 396, 292, 1071, 19, 1223, 70, 2236,
      ],
    }
    for (const [text, tokens] of Object.entries(expected)) {
      expect(Array.from(tokenizer.encode(text)), text).toEqual(tokens)
    }
  })

  it("encode should pad with <|endoftext|> (= <PAD>, <START>, <END>)", () => {
    const { "<|endoftext|>": end, "<PAD>": pad, "<START>": start } = tokenizer.encodeDict
    expect([pad, start]).toEqual([end, end])
    expect(Array.from(tokenizer.encode("Once", 5))).toEqual([end, 199, 4649, end, end])
  })

  it("decode should return readable tokens", () => {
    expect([199, 4649, 2082].map(tokenizer.decode)).toEqual(["\n", "Once", " upon"])
  })

  it("append should join tokens without double spaces", () => {
    expect(tokenizer.append("Once", 2082)).toBe("Once upon")
    expect(tokenizer.append("Once ", 2082)).toBe("Once upon")
    expect(tokenizer.append("time", 12)).toBe("time,")
  })

  it("encode(decodeText(tokens)) should return the same tokens (dataset samples)", async () => {
    const [xTrain] = await fetchMultipleNpzWithProgress(
      ["/data/tinystories/x_train_preview.npz"],
      true,
    )
    const [numSamples, length] = xTrain.shape
    for (let i = 0; i < numSamples; i++) {
      const tokens = Array.from(xTrain.data.slice(i * length, (i + 1) * length), Number)
      const reEncoded = tokenizer.encode(tokenizer.decodeText(tokens), length)
      expect(Array.from(reEncoded), `sample ${i}`).toEqual(tokens)
    }
  })
})

describe("Gpt2Tokenizer", () => {
  const tokenizer = new tokenizers.Gpt2Tokenizer()

  beforeAll(async () => {
    await tokenizer.init()
  })

  it("encode should give the same tokens as the Hugging Face tokenizer in gpt2.py", () => {
    // [50256] + tokenizer.encode(text).ids, original ids: <|endoftext|> = 50256
    const expected = {
      "Hello, my name is GPT-2.": [50256, 15496, 11, 616, 1438, 318, 402, 11571, 12, 17, 13],
      'She said, "I\'m happy!"\n\nThe end.': [
        50256, 3347, 531, 11, 366, 40, 1101, 3772, 2474, 198, 198, 464, 886, 13,
      ],
      "Supercalifragilistic 123 café 🤖": [
        50256, 12442, 9948, 361, 22562, 346, 2569, 17031, 40304, 12520, 97, 244,
      ],
    }
    for (const [text, tokens] of Object.entries(expected)) {
      expect(Array.from(tokenizer.encode(text)), text).toEqual(tokens)
    }
  })

  it("encode should pad with <|endoftext|> (= <PAD>, <START>, <END>)", () => {
    const { "<|endoftext|>": end, "<PAD>": pad, "<START>": start } = tokenizer.encodeDict
    expect([end, pad, start]).toEqual([50256, 50256, 50256])
    expect(Array.from(tokenizer.encode("Hello", 4))).toEqual([end, 15496, end, end])
  })

  it("decode should return readable tokens", () => {
    expect([15496, 11, 616].map(tokenizer.decode)).toEqual(["Hello", ",", " my"])
    expect(tokenizer.decode(50256)).toBe("<|endoftext|>")
  })

  it("encode(decodeText(tokens)) should return the same tokens", () => {
    const text = 'She said, "I\'m happy!"\n\nThe end. Café 🤖'
    const tokens = Array.from(tokenizer.encode(text, 32))
    expect(tokenizer.decodeText(tokens)).toBe(text)
    expect(Array.from(tokenizer.encode(tokenizer.decodeText(tokens), 32))).toEqual(tokens)
  })
})
