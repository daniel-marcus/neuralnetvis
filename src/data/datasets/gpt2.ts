import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const gpt2: DatasetDef = {
  key: "gpt2",
  name: "GPT-2",
  isModelDs: true,
  task: "nextToken",
  description: "Next token prediction on any text (pretrained GPT-2 small)",
  version: new Date("2026-10-06"),
  aboutUrl: "https://openai.com/index/better-language-models/",
  // <|endoftext|> text + padding (<|endoftext|>), cut off after 256 tokens, see ml-notebooks/gpt2.py
  // no samples: only the model, input via the sample viewer
  inputDims: [256],
  outputLabels: [], // vocabulary from the tokenizer, see getVocabulary in dataset.ts
  tokenizerName: "Gpt2Tokenizer",
  model: getModelDef("gpt2"),
  sampleViewer: true,
  drawOptions: {
    title: "Write a text",
  },
}
