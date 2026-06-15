import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { centerCropResize } from "./utils"
import { CustomBtn } from "@/scene-views/custom-btn"
import type { Dataset, SampleRaw } from "./types"

interface SampleAdderArgs {
  ds: Dataset
}
type SampleAdderFunc = (arg: SampleAdderArgs) => Promise<SampleRaw | undefined> | void

export const AddSampleBtn = () => {
  const setCustomSample = useSceneStore((s) => s.setCustomSample)
  const toggleDrawAreaShown = useSceneStore((s) => s.toggleDrawAreaShown)
  const ds = useSceneStore((s) => s.ds)
  const isTextInput = !!ds?.tokenizer
  const addFunc: SampleAdderFunc | undefined = isTextInput
    ? textToSample
    : ds?.showAddImgBtn
      ? getSampleFromImgUrl
      : ds?.drawOptions
        ? toggleDrawAreaShown
        : undefined

  if (!addFunc) return null

  const onClick = async () => {
    if (!ds) return
    try {
      const sampleRaw = await addFunc({ ds })
      if (sampleRaw) setCustomSample(sampleRaw)
    } catch (e) {
      console.error("Error adding sample:", e)
    }
  }
  return <CustomBtn onClick={onClick}>+</CustomBtn>
}

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
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", reject)
  })
}

async function imageToSample(
  image: HTMLImageElement | HTMLCanvasElement,
  inputDims?: number[],
): Promise<SampleRaw | undefined> {
  if (!inputDims || !image.width || !image.height) return
  const [targetHeight, targetWidth] = inputDims
  const numChannels = inputDims[2] || 1
  const imgTensor = tf.browser.fromPixels(image, numChannels)
  const resized = tf.tidy(() => centerCropResize(imgTensor, targetHeight, targetWidth).flatten())
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
