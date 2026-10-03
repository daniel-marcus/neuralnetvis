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
