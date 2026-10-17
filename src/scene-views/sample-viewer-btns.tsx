import { useRef, type ChangeEvent } from "react"
import { setStatus, useSceneStore } from "@/store"
import { VideoCaptureBtns } from "./video"
import { AddSampleBtn } from "@/data/my-sample"
import { CustomBtn } from "./custom-btn"
import { getTextSamples, resetData, saveTextSamples } from "@/data/dataset"
import { isLoraDs } from "@/model/lora/training"

export function CustomBtns() {
  const ds = useSceneStore((s) => s.ds)
  return (
    <>
      {!!ds?.camProps && <VideoCaptureBtns />}
      <AddSampleBtn />
      {isLoraDs(ds) && <AddTextFilesBtn />}
      {isLoraDs(ds) && <ClearSamplesBtn />}
    </>
  )
}

const TEXT_FILE_TYPES = ".txt,.md,.markdown,text/plain,text/markdown" // extensions: .md often has no type
const CONFIRM_SAMPLES = 1000 // ask before adding more samples (~1 MB of text), training time grows with them

// LoRA: text files (.txt, .md) as training samples, long texts are split (see getTextSamples)
function AddTextFilesBtn() {
  const ds = useSceneStore((s) => s.ds)
  const updateMeta = useSceneStore((s) => s.updateMeta)
  const isTraining = useSceneStore((s) => s.isTraining)
  const inputRef = useRef<HTMLInputElement>(null)
  if (!ds || isTraining) return null

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = "" // the same files can be selected again
    if (!files.length) return
    try {
      const texts = await Promise.all(
        files.map(async (f) => ({ text: await f.text(), name: f.name })),
      )
      const samples = getTextSamples(ds, texts)
      const n = samples.length
      if (!n) return setStatus("No text in the selected files")
      if (n > CONFIRM_SAMPLES && !window.confirm(`Add ${n} training samples?`)) return
      updateMeta("train", await saveTextSamples(ds, samples))
      setStatus(`Added ${plural(n, "training sample")} from ${plural(files.length, "file")}`)
    } catch (err) {
      console.error("Failed to add text files", err)
      setStatus("Failed to add the text files")
    }
  }
  return (
    <>
      <CustomBtn onClick={() => inputRef.current?.click()}>+</CustomBtn>
      <input
        ref={inputRef}
        type="file"
        accept={TEXT_FILE_TYPES}
        multiple
        className="hidden"
        onChange={onChange}
      />
    </>
  )
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// LoRA: the texts saved as training samples (as for recorded hand poses, see HandPoseCapture)
function ClearSamplesBtn() {
  const ds = useSceneStore((s) => s.ds)
  const isTraining = useSceneStore((s) => s.isTraining)
  if (!ds?.train.totalSamples || isTraining) return null
  return (
    <CustomBtn
      onClick={async () => {
        const confirm = window.confirm("Are you sure you want to clear all saved samples?")
        if (confirm) await resetData(ds.key, "train")
      }}
    >
      x
    </CustomBtn>
  )
}
