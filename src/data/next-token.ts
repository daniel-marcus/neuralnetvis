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

// sample the next token from the predicted probabilities, as generate() in ml-notebooks/tweets.py
// temperature < 1: more conservative (likely words), > 1: more random
// topP < 1: only sample from the most likely tokens that together cover topP of the probability (nucleus)
export function sampleNextToken(
  probs: ArrayLike<number>,
  { temperature = 0.8, topP = 1, excludedTokens = [] as number[], random = Math.random } = {},
) {
  const excluded = new Set(excludedTokens)
  const weights = Array.from(probs, (p, token) =>
    excluded.has(token) ? 0 : p ** (1 / temperature),
  )
  if (topP < 1) keepNucleus(weights, topP)
  let threshold = random() * weights.reduce((a, b) => a + b, 0)
  for (const [token, weight] of weights.entries()) {
    threshold -= weight
    if (threshold < 0) return token
  }
  return weights.findLastIndex((w) => w > 0) // rounding errors
}

// zeroes the weights outside the nucleus: the most likely tokens are kept until they reach topP of the total
function keepNucleus(weights: number[], topP: number) {
  const target = topP * weights.reduce((a, b) => a + b, 0)
  // the smallest weight in the nucleus (native numeric sort: fast for large vocabularies, GPT-2: 50257)
  const sorted = Float64Array.from(weights).toSorted().toReversed()
  let [cumulative, threshold] = [0, 0]
  for (const weight of sorted) {
    if (cumulative >= target) break
    cumulative += weight
    threshold = weight
  }
  weights.forEach((weight, token) => {
    if (weight < threshold) weights[token] = 0
  })
}
