import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import throttle from "lodash.throttle"
import { clearStatus, setStatus, useSceneStore } from "@/store"
import { Button } from "@/components/ui-elements"
import { getSeqPosition, sampleNextToken } from "./next-token"
import { InputArea } from "./input-area"
import { addTextSample } from "./dataset"
import { isLoraDs } from "@/model/lora/training"
import { KVCache } from "@/model/kv-cache"
import { matchesKeys } from "@/utils/key-command"
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
  useAutocomplete(isAutocompleting, setIsAutocompleting, text, setText, updateSample)
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
  // after saving a training sample: ready for the next one
  const clearAndFocus = () => {
    handleInput("")
    textareaRef.current?.focus()
  }

  const canSaveForTraining = isLoraDs(ds)
  const saveForTraining = useSaveForTraining(text, clearAndFocus)

  const canAutocomplete = ds?.task === "nextToken" && !!probs
  const toggleAutocomplete = () => setIsAutocompleting((v) => !v)
  // Enter: autocomplete (Shift+Enter: new line), Esc: clear, cmd+s: save
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return // e.g. confirming an IME candidate
    if (matchesKeys(e, KEYS.autocomplete) && canAutocomplete) {
      e.preventDefault()
      toggleAutocomplete()
    } else if (matchesKeys(e, KEYS.clear)) {
      e.preventDefault()
      handleInput("")
    } else if (matchesKeys(e, KEYS.save) && canSaveForTraining) {
      e.preventDefault() // also if nothing to save: no browser save dialog
      if (!saveForTraining.disabled) saveForTraining.save()
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
          {canSaveForTraining && (
            <Button
              onClick={saveForTraining.save}
              variant="secondary"
              disabled={saveForTraining.disabled}
              title="Save as training data"
              keyHint={KEYS.save}
            >
              save
            </Button>
          )}
          {ds?.task === "nextToken" && (
            <Button
              onClick={toggleAutocomplete}
              disabled={!canAutocomplete}
              keyHint={KEYS.autocomplete}
            >
              {isAutocompleting ? "stop" : "complete"}
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

// LoRA: saves the text as training sample (see model/lora)
function useSaveForTraining(text: string, onSaved: () => void) {
  const ds = useSceneStore((s) => s.ds)
  const updateMeta = useSceneStore((s) => s.updateMeta)
  const isTraining = useSceneStore((s) => s.isTraining)
  const [isSaving, setIsSaving] = useState(false)
  const save = async () => {
    if (!ds) return
    setIsSaving(true)
    try {
      const meta = await addTextSample(ds, text)
      updateMeta("train", meta)
      setStatus(`Saved as training sample ${meta.totalSamples}`, null, { id: SAVE_STATUS_ID })
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }
  return { save, disabled: !text.trim() || isTraining || isSaving }
}

const SAVE_STATUS_ID = "save_training_sample"

// while typing in the textarea (see handleKeyDown), shown as hints on the buttons (except clear: space)
const KEYS = { autocomplete: "Enter", clear: "Escape", save: "mod+s" }

const INPUT_THROTTLE = 0 // ms, min. time between sample updates (typing, suggestions, autocomplete)
const NUM_SUGGESTIONS = 5
const AUTOCOMPLETE_TEMPERATURE = 0.8 // < 1: more likely words, as generate() in ml-notebooks/tweets.py
const AUTOCOMPLETE_TOP_P = 0.9 // only the most likely words that cover 90% of the probability
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
    return getTopTokens(probs, NUM_SUGGESTIONS, specialTokens).map(({ prob, token }) => ({
      token,
      word: tokenizer.decode(token).replaceAll("\n", "↵"),
      prob,
    }))
  }, [ds, probs])
}

// nextToken: appends sampled words until <END> or the max. length is reached. Only the model output with a
// KV cache (see model/kv-cache), the visualization shows the final text (sample updated when stopped)
function useAutocomplete(
  isAutocompleting: boolean,
  setIsAutocompleting: (value: boolean) => void,
  text: string,
  setText: (text: string) => void,
  updateSample: (text: string) => void,
) {
  const ds = useSceneStore((s) => s.ds)
  const model = useSceneStore((s) => s.model)
  // not as effect deps: each appended word would restart autocomplete
  const latest = useRef({ text, setText, updateSample, setIsAutocompleting })
  useEffect(() => {
    latest.current = { text, setText, updateSample, setIsAutocompleting }
  })
  useEffect(() => {
    const tokenizer = ds?.tokenizer
    if (!isAutocompleting || !tokenizer || !model) return
    const stop = new AbortController()
    const generate = async () => {
      const cache = new KVCache(model)
      const { "<PAD>": pad, "<START>": start, "<OOV>": oov, "<END>": end } = tokenizer.encodeDict
      // <END> can be the same token as <PAD> and <START> (TinyStories: <|endoftext|>)
      const excludedTokens = [pad, start, oov].filter((t) => t !== undefined && t !== end)
      const seqLen = ds.inputDims[0]
      let completed = latest.current.text
      const encoded = tokenizer.encode(completed, seqLen)
      let tokens = Array.from(encoded.slice(0, getSeqPosition(encoded, tokenizer) + 1))
      const stats = { numTokens: 0, firstTokenTime: 0, lastTokenTime: 0 }
      try {
        while (!stop.signal.aborted && cache.length + tokens.length <= seqLen) {
          const probsTensor = cache.append(tokens) // the text first, then each new token
          const probs = (await probsTensor.data()) as Float32Array
          probsTensor.dispose()
          if (stop.signal.aborted) break
          const token = sampleNextToken(probs, {
            temperature: AUTOCOMPLETE_TEMPERATURE,
            topP: AUTOCOMPLETE_TOP_P,
            excludedTokens,
          })
          if (token === end) break
          completed = tokenizer.append(completed, token)
          latest.current.setText(completed)
          tokens = [token]
          stats.numTokens++
          stats.lastTokenTime = performance.now()
          if (stats.numTokens === 1) stats.firstTokenTime = stats.lastTokenTime
          const data = getAutocompleteStats(stats)
          setStatus({ title: "Autocomplete ...", data }, null, { id: AUTOCOMPLETE_STATUS_ID })
        }
      } finally {
        cache.dispose()
        if (latest.current.text === completed) latest.current.updateSample(completed) // unless edited meanwhile
        const data = getAutocompleteStats(stats)
        if (!stats.numTokens) clearStatus(AUTOCOMPLETE_STATUS_ID)
        else
          setStatus({ title: "Autocomplete finished", data }, null, { id: AUTOCOMPLETE_STATUS_ID })
        if (!stop.signal.aborted) latest.current.setIsAutocompleting(false) // <END> or max. length
      }
    }
    generate().catch((e) => console.error("Autocomplete failed", e))
    return () => stop.abort()
  }, [isAutocompleting, ds, model])
}

// the n most probable tokens, sorted (single pass instead of sorting the whole vocabulary)
function getTopTokens(probs: Float32Array, n: number, excluded: Set<number>) {
  const top: { prob: number; token: number }[] = []
  for (let token = 0; token < probs.length; token++) {
    const prob = probs[token]
    if ((top.length === n && prob <= top[n - 1].prob) || excluded.has(token)) continue
    const idx = top.findIndex((t) => prob > t.prob)
    top.splice(idx === -1 ? top.length : idx, 0, { prob, token })
    if (top.length > n) top.pop()
  }
  return top
}

// tokens/s: average from the first to the last token (the 1st one uses the prediction that was already there)
function getAutocompleteStats(stats: {
  numTokens: number
  firstTokenTime: number
  lastTokenTime: number
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
