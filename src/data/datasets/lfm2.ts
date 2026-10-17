import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const lfm2: DatasetDef = {
  key: "lfm2.5",
  name: "LFM2.5",
  isModelDs: true,
  task: "nextToken",
  description: "Chat with a small language model (pretrained LFM2.5-350M)",
  version: new Date("2026-10-17"),
  aboutUrl: "https://www.liquid.ai/blog/lfm2-5-350m-no-size-left-behind",
  // the conversation in the chat template (see Lfm2ChatTokenizer) + padding (<|pad|>), cut off after 256 tokens,
  // see ml-notebooks/lfm2.py
  // no samples: only the model, input via the sample viewer
  inputDims: [256],
  outputLabels: [], // vocabulary from the tokenizer, see getVocabulary in dataset.ts
  tokenizerName: "Lfm2ChatTokenizer",
  model: getModelDef("lfm2.5-350m"),
  sampleViewer: true,
  drawOptions: {
    title: "Chat",
  },
}
