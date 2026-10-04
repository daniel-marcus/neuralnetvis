import { useEffect, useMemo, useRef, useState } from "react"
import throttle from "lodash.throttle"
import { useSceneStore } from "@/store"
import { Button } from "@/components/ui-elements"
import { sampleNextToken } from "./next-token"
import { InputArea } from "./input-area"
import type { Dataset, SampleRaw } from "./types"

export const TextArea = ({ title = "" }) => {
  const [text, setText] = useState("")
  const ds = useSceneStore((s) => s.ds)
  const sample = useSceneStore((s) => s.sample)
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setCustomSample = useSceneStore((s) => s.setCustomSample)
  const [isAutocompleting, setIsAutocompleting] = useState(false)

  const updateSample = useMemo(
    () =>
      throttle((newText: string) => {
        const newSample = ds && textToSample(newText, ds)
        if (newSample) setCustomSample(newSample)
      }, 150),
    [ds, setCustomSample],
  )
  useEffect(() => () => updateSample.cancel(), [updateSample])

  // show text of the selected dataset sample (editable); custom samples have no sampleIdx
  const dsSample =
    sample && sampleIdx !== undefined && sample.index === sampleIdx ? sample : undefined
  const [shownSample, setShownSample] = useState<typeof dsSample>(undefined)
  if (dsSample && dsSample !== shownSample && ds?.tokenizer) {
    setShownSample(dsSample)
    setText(ds.tokenizer.decodeText(dsSample.rawX ?? dsSample.X))
    setIsAutocompleting(false)
  }
  useEffect(() => {
    if (dsSample) updateSample.cancel() // drop pending input from the previous sample
  }, [dsSample, updateSample])

  const handleChange = (newText: string) => {
    setText(newText)
    updateSample(newText)
  }

  const probs = useNextWordProbs()
  const suggestions = useNextWordSuggestions(probs)
  const appendWord = (word: string) => handleChange(`${text.trimEnd()} ${word} `.trimStart())
  useAutocomplete(isAutocompleting, setIsAutocompleting, text, probs, appendWord)
  const handleInput = (newText: string) => {
    setIsAutocompleting(false) // typing stops autocomplete
    handleChange(newText)
  }

  return (
    <InputArea
      title={title}
      buttons={
        <>
          <Button onClick={() => handleInput("")} variant="secondary">
            clear
          </Button>
          {ds?.task === "nextToken" && (
            <Button onClick={() => setIsAutocompleting((v) => !v)} disabled={!probs}>
              {isAutocompleting ? "stop" : "autocomplete"}
            </Button>
          )}
        </>
      }
    >
      <div className="w-full aspect-square flex flex-col border-2 rounded-2xl bg-box-dark border-menu-border focus-within:border-accent">
        <textarea
          className="flex-1 min-h-0 p-3 bg-transparent resize-none outline-none"
          value={text}
          onChange={(e) => handleInput(e.target.value)}
        />
        {!!suggestions.length && (
          <div className="flex overflow-auto sm:flex-wrap gap-1 p-2">
            {suggestions.map(({ word, prob }) => (
              <Button key={word} variant="chip" onClick={() => appendWord(word)}>
                {word}&nbsp;<span className="opacity-50">{Math.round(prob * 100)}%</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </InputArea>
  )
}

const NUM_SUGGESTIONS = 5
const AUTOCOMPLETE_TEMPERATURE = 0.8 // < 1: more likely words, as generate() in ml-notebooks/tweets.py
const AUTOCOMPLETE_DELAY = 300 // ms between words, to follow the activations

// nextToken: probabilities for the next word (output layer activations at the current position)
function useNextWordProbs() {
  const ds = useSceneStore((s) => s.ds)
  const outputLayerIdx = useSceneStore((s) => s.allLayers.at(-1)?.index)
  const probs = useSceneStore((s) =>
    outputLayerIdx === undefined ? undefined : s.activations[outputLayerIdx]?.activations,
  )
  return ds?.task === "nextToken" ? probs : undefined
}

// nextToken: most probable next words
function useNextWordSuggestions(probs?: Float32Array) {
  const ds = useSceneStore((s) => s.ds)
  return useMemo(() => {
    const tokenizer = ds?.tokenizer
    if (ds?.task !== "nextToken" || !tokenizer || !probs) return []
    const specialTokens = new Set(
      ["<PAD>", "<START>", "<OOV>", "<END>"].map((t) => tokenizer.encodeDict[t]),
    )
    return Array.from(probs, (prob, token) => ({ prob, token }))
      .filter(({ token }) => !specialTokens.has(token))
      .toSorted((a, b) => b.prob - a.prob)
      .slice(0, NUM_SUGGESTIONS)
      .map(({ prob, token }) => ({ word: tokenizer.decode(token), prob }))
  }, [ds, probs])
}

// nextToken: appends sampled words until <END> or the max. length is reached. Each new word changes the
// sample, the model computes the activations (visualized) and the probabilities for the next word
function useAutocomplete(
  isAutocompleting: boolean,
  setIsAutocompleting: (value: boolean) => void,
  text: string,
  probs: Float32Array | undefined,
  appendWord: (word: string) => void,
) {
  const ds = useSceneStore((s) => s.ds)
  const latest = useRef({ text, appendWord }) // not as effect deps: re-renders would restart the delay
  useEffect(() => {
    latest.current = { text, appendWord }
  })
  const usedProbs = useRef<Float32Array>(undefined) // each prediction is used only once
  useEffect(() => {
    if (isAutocompleting) usedProbs.current = undefined // (re)start with the current prediction
  }, [isAutocompleting])
  useEffect(() => {
    const tokenizer = ds?.tokenizer
    if (!isAutocompleting || !tokenizer || !probs || probs === usedProbs.current) return
    const timeout = setTimeout(() => {
      usedProbs.current = probs
      const { "<PAD>": pad, "<START>": start, "<OOV>": oov, "<END>": end } = tokenizer.encodeDict
      const token = sampleNextToken(probs, {
        temperature: AUTOCOMPLETE_TEMPERATURE,
        excludedTokens: [pad, start, oov],
      })
      const numWords = latest.current.text.split(" ").filter(Boolean).length
      const maxWords = ds.inputDims[0] - 1 // without <START>
      if (token === end || numWords >= maxWords) setIsAutocompleting(false)
      else latest.current.appendWord(tokenizer.decode(token))
    }, AUTOCOMPLETE_DELAY)
    return () => clearTimeout(timeout)
  }, [isAutocompleting, setIsAutocompleting, probs, ds])
}

function textToSample(text: string, ds: Dataset): SampleRaw | undefined {
  if (!ds.tokenizer) return
  const X = ds.tokenizer.encode(text, ds.inputDims[0])
  return { X, index: Date.now() }
}
