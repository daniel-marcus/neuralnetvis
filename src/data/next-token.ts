import type { TokenizerType } from "./tokenizer"

// Next token prediction: the model predicts the next token for every position of the input sequence.
// The visualization shows the prediction at the "current" position = the last (typed) word.

export function getSeqPosition(tokens: ArrayLike<number>, tokenizer?: TokenizerType) {
  const { "<PAD>": pad, "<END>": end } = tokenizer?.encodeDict ?? {}
  let position = 0
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== pad && tokens[i] !== end) position = i
  }
  return position
}
