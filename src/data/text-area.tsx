import { useEffect, useMemo, useState } from "react"
import throttle from "lodash.throttle"
import { useSceneStore } from "@/store"
import { Button } from "@/components/ui-elements"
import type { Dataset, SampleRaw } from "./types"

export const TextArea = ({ title = "" }) => {
  const [text, setText] = useState("")
  const toggleInputAreaShown = useSceneStore((s) => s.toggleInputAreaShown)
  const ds = useSceneStore((s) => s.ds)
  const sample = useSceneStore((s) => s.sample)
  const sampleIdx = useSceneStore((s) => s.sampleIdx)
  const setCustomSample = useSceneStore((s) => s.setCustomSample)

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
  }
  useEffect(() => {
    if (dsSample) updateSample.cancel() // drop pending input from the previous sample
  }, [dsSample, updateSample])

  const handleChange = (newText: string) => {
    setText(newText)
    updateSample(newText)
  }

  const suggestions = useNextWordSuggestions()
  const appendWord = (word: string) => handleChange(`${text.trimEnd()} ${word} `.trimStart())

  return (
    <div className="z-20 flex flex-col items-center gap-2 pointer-events-auto pt-8">
      <div>{title}</div>
      <div className="w-40 lg:w-75 aspect-square flex flex-col border-2 rounded-2xl bg-box-dark border-menu-border focus-within:border-accent">
        <textarea
          className="flex-1 min-h-0 p-3 bg-transparent resize-none outline-none"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
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
      <div className="flex gap-2">
        <Button onClick={() => handleChange("")}>clear</Button>
        <Button onClick={toggleInputAreaShown} variant="secondary">
          close
        </Button>
      </div>
    </div>
  )
}

const NUM_SUGGESTIONS = 5

// nextToken: most probable next words (output layer activations at the current position)
function useNextWordSuggestions() {
  const ds = useSceneStore((s) => s.ds)
  const outputLayerIdx = useSceneStore((s) => s.allLayers.at(-1)?.index)
  const probs = useSceneStore((s) =>
    outputLayerIdx === undefined ? undefined : s.activations[outputLayerIdx]?.activations,
  )
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

function textToSample(text: string, ds: Dataset): SampleRaw | undefined {
  if (!ds.tokenizer) return
  const X = ds.tokenizer.encode(text, ds.inputDims[0])
  return { X, index: Date.now() }
}
