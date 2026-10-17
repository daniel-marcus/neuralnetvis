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
  const threshold = getNucleusThreshold(weights, topP * weights.reduce((a, b) => a + b, 0))
  weights.forEach((weight, token) => {
    if (weight < threshold) weights[token] = 0
  })
}

// the smallest weight in the nucleus without sorting (GPT-2: 50257 tokens, the nucleus can be thousands):
// partitions around a random pivot and continues with the side that contains the threshold (weighted quickselect)
function getNucleusThreshold(weights: number[], target: number) {
  if (target <= 0) return 0
  let values = Float64Array.from(weights)
  for (;;) {
    const pivot = values[Math.floor(Math.random() * values.length)]
    const [upper, lower] = [new Float64Array(values.length), new Float64Array(values.length)]
    let [numUpper, numLower, upperSum, pivotSum] = [0, 0, 0, 0]
    for (const value of values) {
      if (value > pivot) {
        upper[numUpper++] = value
        upperSum += value
      } else if (value < pivot) lower[numLower++] = value
      else pivotSum += value
    }
    if (upperSum >= target) values = upper.subarray(0, numUpper) // the threshold is larger than the pivot
    else if (upperSum + pivotSum >= target || !numLower) return pivot // (no smaller weights: rounding errors)
    else {
      target -= upperSum + pivotSum // still needed from the smaller weights
      values = lower.subarray(0, numLower)
    }
  }
}
