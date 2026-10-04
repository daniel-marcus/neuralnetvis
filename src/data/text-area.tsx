import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import throttle from "lodash.throttle"
import { clearStatus, setStatus, useSceneStore } from "@/store"
import { Button } from "@/components/ui-elements"
import { getSeqPosition, sampleNextToken } from "./next-token"
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
      }, INPUT_THROTTLE),
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
  const appendToken = (token: number) => {
    if (ds?.tokenizer) handleChange(ds.tokenizer.append(text, token))
  }
  useAutocomplete(isAutocompleting, setIsAutocompleting, text, probs, appendToken)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    // autocomplete: keep the newest words in view (runs after each appended word)
    const textarea = textareaRef.current
    if (isAutocompleting && text && textarea) textarea.scrollTop = textarea.scrollHeight
  }, [isAutocompleting, text])
  const handleInput = (newText: string) => {
    setIsAutocompleting(false) // typing stops autocomplete
    handleChange(newText)
  }

  const canAutocomplete = ds?.task === "nextToken" && !!probs
  const toggleAutocomplete = () => setIsAutocompleting((v) => !v)
  // Enter: autocomplete (Shift+Enter: new line), Esc: clear
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return // e.g. confirming an IME candidate
    if (e.key === "Enter" && !e.shiftKey && canAutocomplete) {
      e.preventDefault()
      toggleAutocomplete()
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleInput("")
    }
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
            <Button onClick={toggleAutocomplete} disabled={!canAutocomplete}>
              {isAutocompleting ? "stop" : "autocomplete"}
            </Button>
          )}
        </>
      }
    >
      <div className="w-full aspect-square flex flex-col border-2 rounded-2xl bg-box-dark border-menu-border focus-within:border-accent">
        <textarea
          ref={textareaRef}
          className="flex-1 min-h-0 p-3 bg-transparent resize-none outline-none"
          value={text}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {!!suggestions.length && (
          // sm: max. 2 rows of chips (2 * h-6.5 + gap-1 + p-2), a 3rd row is cut off: no layout shifts
          <div className="flex overflow-auto sm:flex-wrap sm:h-18 sm:overflow-hidden gap-1 p-2">
            {suggestions.map(({ token, word, prob }) => (
              <Button key={token} variant="chip" onClick={() => appendToken(token)}>
                {word}&nbsp;<span className="opacity-50">{Math.round(prob * 100)}%</span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </InputArea>
  )
}

const INPUT_THROTTLE = 0 // ms, min. time between sample updates (typing, suggestions, autocomplete)
const NUM_SUGGESTIONS = 5
const AUTOCOMPLETE_TEMPERATURE = 0.8 // < 1: more likely words, as generate() in ml-notebooks/tweets.py
const AUTOCOMPLETE_TOP_P = 0.9 // only the most likely words that cover 90% of the probability
const AUTOCOMPLETE_DELAY = 0 // ms between words: as fast as inference and rendering allow (min. INPUT_THROTTLE)
const AUTOCOMPLETE_STATUS_ID = "autocomplete"

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
      .map(({ prob, token }) => ({
        token,
        word: tokenizer.decode(token).replaceAll("\n", "↵"),
        prob,
      }))
  }, [ds, probs])
}

// nextToken: appends sampled words until <END> or the max. length is reached. Each new word changes the
// sample, the model computes the activations (visualized) and the probabilities for the next word
function useAutocomplete(
  isAutocompleting: boolean,
  setIsAutocompleting: (value: boolean) => void,
  text: string,
  probs: Float32Array | undefined,
  appendToken: (token: number) => void,
) {
  const ds = useSceneStore((s) => s.ds)
  const latest = useRef({ text, appendToken }) // not as effect deps: re-renders would restart the delay
  useEffect(() => {
    latest.current = { text, appendToken }
  })
  const usedProbs = useRef<Float32Array>(undefined) // each prediction is used only once
  const stats = useRef({ numTokens: 0, firstTokenTime: 0, lastTokenTime: 0, contextUsed: 0 })
  useEffect(() => {
    if (!isAutocompleting) return
    usedProbs.current = undefined // (re)start with the current prediction
    stats.current = { numTokens: 0, firstTokenTime: 0, lastTokenTime: 0, contextUsed: 0 }
    return () => {
      // stopped (or unmounted): keep the final stats, expiring
      const { numTokens } = stats.current
      if (!numTokens) return clearStatus(AUTOCOMPLETE_STATUS_ID)
      const data = getAutocompleteStats(stats.current)
      setStatus({ title: "Autocomplete finished", data }, null, { id: AUTOCOMPLETE_STATUS_ID })
    }
  }, [isAutocompleting])
  useEffect(() => {
    const tokenizer = ds?.tokenizer
    if (!isAutocompleting || !tokenizer || !probs || probs === usedProbs.current) return
    const timeout = setTimeout(() => {
      usedProbs.current = probs
      const { "<PAD>": pad, "<START>": start, "<OOV>": oov, "<END>": end } = tokenizer.encodeDict
      const token = sampleNextToken(probs, {
        temperature: AUTOCOMPLETE_TEMPERATURE,
        topP: AUTOCOMPLETE_TOP_P,
        // <END> can be the same token as <PAD> and <START> (TinyStories: <|endoftext|>)
        excludedTokens: [pad, start, oov].filter((t) => t !== undefined && t !== end),
      })
      const seqLen = ds.inputDims[0]
      const seqPos = getSeqPosition(tokenizer.encode(latest.current.text, seqLen), tokenizer)
      if (token === end || seqPos >= seqLen - 1) setIsAutocompleting(false)
      else {
        latest.current.appendToken(token)
        const { current } = stats
        current.numTokens++
        current.lastTokenTime = performance.now()
        if (current.numTokens === 1) current.firstTokenTime = current.lastTokenTime
        current.contextUsed = Math.min((seqPos + 1) / (seqLen - 1), 1)
        const data = getAutocompleteStats(current)
        setStatus({ title: "Autocomplete ...", data }, null, { id: AUTOCOMPLETE_STATUS_ID })
      }
    }, AUTOCOMPLETE_DELAY)
    return () => clearTimeout(timeout)
  }, [isAutocompleting, setIsAutocompleting, probs, ds])
}

// tokens/s: average from the first to the last token (the 1st one uses the prediction that was already there)
function getAutocompleteStats(stats: {
  numTokens: number
  firstTokenTime: number
  lastTokenTime: number
  contextUsed: number
}) {
  const { numTokens, firstTokenTime, lastTokenTime } = stats
  const seconds = (lastTokenTime - firstTokenTime) / 1000
  const tokensPerSec = numTokens > 1 && seconds > 0 ? (numTokens - 1) / seconds : undefined
  return {
    // Tokens: `${numTokens}`,
    // Context: `${Math.round(contextUsed * 100)} %`,
    "": tokensPerSec ? `${tokensPerSec.toFixed(1)} tokens/s` : "",
  }
}

function textToSample(text: string, ds: Dataset): SampleRaw | undefined {
  if (!ds.tokenizer) return
  const X = ds.tokenizer.encode(text, ds.inputDims[0])
  return { X, index: Date.now() }
}
