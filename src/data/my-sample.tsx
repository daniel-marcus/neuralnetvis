import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { centerCropResize } from "./utils"
import { CustomBtn } from "@/scene-views/sample-viewer-btns"
import type { Dataset, SampleRaw } from "./types"

interface SampleAdderArgs {
  ds: Dataset
}
type SampleAdderFunc = (
  arg: SampleAdderArgs,
) => Promise<SampleRaw | undefined> | void

export const AddSampleBtn = () => {
  const setCustomSample = useSceneStore((s) => s.setCustomSample)
  const toggleDrawAreaShown = useSceneStore((s) => s.toggleDrawAreaShown)
  const ds = useSceneStore((s) => s.ds)
  const isTextInput = !!ds?.tokenizer
  const addFunc: SampleAdderFunc | undefined = isTextInput
    ? textToSample
    : ds?.showAddImgBtn
      ? getSampleFromImgUrl
      : ds?.key === "mnist"
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
    image.onload = () => resolve(image)
    image.onerror = reject
  })
}

export async function imageToSample(
  image: HTMLImageElement | HTMLCanvasElement,
  inputDims?: number[],
): Promise<SampleRaw | undefined> {
  if (!inputDims || !image.width || !image.height) return
  const [targetHeight, targetWidth] = inputDims
  const numChannels = inputDims[2] || 1
  const imgTensor = tf.browser.fromPixels(image, numChannels)
  const resized = tf.tidy(() =>
    centerCropResize(imgTensor, targetHeight, targetWidth).flatten(),
  )
  try {
    const X = (await resized.data()) as SampleRaw["X"]
    return { X, index: Date.now() }
  } finally {
    resized.dispose()
    imgTensor.dispose()
  }
}

/**
 * Convert image or canvas with auto-padding and centering to MNIST-style sample.
 */
export async function imageToMnistSample(
  image: HTMLImageElement | HTMLCanvasElement,
  inputDims?: number[],
): Promise<SampleRaw | undefined> {
  if (!inputDims || !image.width || !image.height) return
  const [targetHeight, targetWidth] = inputDims
  const numChannels = inputDims[2] || 1
  const imgTensor = tf.browser.fromPixels(image, numChannels)

  const processed = tf.tidy(() => {
    const [height, width] = imgTensor.shape
    const grayscale =
      numChannels === 1 ? imgTensor.squeeze() : imgTensor.mean(-1)
    const mask = grayscale.greater(10)
    const rowSums = mask.sum(1).arraySync() as number[]
    const colSums = mask.sum(0).arraySync() as number[]

    let top = rowSums.findIndex((sum) => sum > 0)
    let bottom =
      rowSums.length - 1 - [...rowSums].reverse().findIndex((sum) => sum > 0)
    let left = colSums.findIndex((sum) => sum > 0)
    let right =
      colSums.length - 1 - [...colSums].reverse().findIndex((sum) => sum > 0)

    if (top === -1 || left === -1)
      [top, bottom, left, right] = [0, height - 1, 0, width - 1]

    const cropped = tf.slice(
      imgTensor,
      [top, left, 0],
      [bottom - top + 1, right - left + 1, numChannels],
    )
    const padded = tf.pad(
      cropped,
      [
        [50, 50],
        [50, 50],
        [0, 0],
      ],
      0,
    )
    const [h, w] = padded.shape
    const scale = Math.min(targetHeight / h, targetWidth / w)
    const [newH, newW] = [Math.round(h * scale), Math.round(w * scale)]
    const scaled = tf.image.resizeBilinear(padded, [newH, newW])
    const [pT, pL] = [
      Math.floor((targetHeight - newH) / 2),
      Math.floor((targetWidth - newW) / 2),
    ]
    return tf
      .pad(
        scaled,
        [
          [pT, targetHeight - newH - pT],
          [pL, targetWidth - newW - pL],
          [0, 0],
        ],
        0,
      )
      .flatten()
  })

  try {
    const X = (await processed.data()) as SampleRaw["X"]
    return { X, index: Date.now() }
  } finally {
    processed.dispose()
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
