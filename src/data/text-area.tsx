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

  return (
    <div className="z-20 flex flex-col items-center gap-2 pointer-events-auto pt-8">
      <div>{title}</div>
      <textarea
        className={`w-40 lg:w-75 aspect-square border-2 rounded-2xl bg-box-dark border-menu-border p-3 resize-none`}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />
      <div className="flex gap-2">
        <Button onClick={() => handleChange("")}>clear</Button>
        <Button onClick={toggleInputAreaShown} variant="secondary">
          close
        </Button>
      </div>
    </div>
  )
}

function textToSample(text: string, ds: Dataset): SampleRaw | undefined {
  if (!ds.tokenizer) return
  const X = ds.tokenizer.encode(text, ds.inputDims[0])
  return { X, index: Date.now() }
}
