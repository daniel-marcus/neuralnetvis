import { useCallback } from "react"
import * as tf from "@tensorflow/tfjs"
import { useGlobalStore, useSceneStore } from "@/store"
import { centerCropResize } from "./utils"
import type { Dataset, SampleRaw } from "./types"

export function useMySample() {
  // TODO: img: add to dataset?
  const ds = useSceneStore((s) => s.ds)
  const setTab = useGlobalStore((s) => s.setTab)
  const openNewDsTab = useCallback(() => setTab("data"), [setTab])
  const isTextInput = !!ds?.tokenizer
  const toggleRecording = useSceneStore((s) => s.toggleRecording)
  const stream = useSceneStore((s) => s.stream)
  const addFunc: SampleAdderFunc | undefined =
    ds?.camProps?.processor === "handPose"
      ? ds.isUserGenerated
        ? !!stream
          ? toggleRecording
          : undefined
        : openNewDsTab
      : isTextInput
      ? textToSample
      : getSampleFromImgUrl
  const setSample = useSceneStore((s) => s.setSample)
  const onBtnClick = useCallback(async () => {
    if (!ds || !addFunc) return
    try {
      const sampleRaw = await addFunc({ ds })
      if (sampleRaw) setSample(sampleRaw, true)
    } catch (e) {
      console.error("Error adding sample:", e)
    }
  }, [ds, setSample, addFunc])
  return addFunc ? onBtnClick : undefined
}

interface SampleAdderArgs {
  ds: Dataset
}
type SampleAdderFunc = (
  arg: SampleAdderArgs
) => Promise<SampleRaw | undefined> | void

const getSampleFromImgUrl: SampleAdderFunc = async ({ ds }) => {
  const url = window.prompt("Enter image URL:")
  if (!url) return
  const image = await loadExternalImage(url)
  return imageToSample(image, ds.inputDims)
}

async function loadExternalImage(url: string) {
  const image = new Image()
  image.crossOrigin = "anonymous"
  image.src = url
  return new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image)
    image.onerror = reject
  })
}

async function imageToSample(
  image: HTMLImageElement,
  inputDims?: number[]
): Promise<SampleRaw | undefined> {
  if (!inputDims || !image.width || !image.height) return
  const [targetHeight, targetWidth] = inputDims
  const imgTensor = tf.browser.fromPixels(image)
  const resized = tf.tidy(() =>
    centerCropResize(imgTensor, targetHeight, targetWidth).flatten()
  )
  try {
    const X = (await resized.data()) as SampleRaw["X"]
    return { X, index: Date.now() }
  } finally {
    resized.dispose()
    imgTensor.dispose()
  }
}

const textToSample: SampleAdderFunc = async ({ ds }) => {
  const tokenizer = ds.tokenizer!
  const text = window.prompt("Enter some text:")
  const length = ds.inputDims[0]
  const tokens = tokenizer.encode(text ?? "", length)
  if (!tokens) return
  const newSample: SampleRaw = {
    X: tokens,
    index: Date.now(),
  }
  return newSample
}
