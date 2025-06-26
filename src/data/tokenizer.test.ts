import { describe, it, expect, beforeAll } from "vitest"
import { tokenizers } from "./tokenizer"

describe("IMDBTokenizer", () => {
  const tokenizer = new tokenizers.IMDbTokenizer()

  beforeAll(async () => {
    await tokenizer.init()
  })

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
    expect(
      encoded.slice(3).every((tkn) => tkn === tokenizer.encodeDict["<PAD>"])
    ).toBe(true)
  })

  it("encode->decode should return (normalized) input w/ <OOV>", () => {
    const rawText = "Wtf is this outofvocabulary"
    const encoded = tokenizer.encode(rawText, 5)
    const decoded = [...encoded].slice(1).map((tkn) => tokenizer.decode(tkn))
    const decodedStr = decoded.join(" ")
    expect(decodedStr).toEqual("wtf is this <OOV>")
  })
})
