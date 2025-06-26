import { useCallback, useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { centerCropResize } from "./utils"
import { SampleRaw } from "./types"

export function useMySample() {
  // TODO: use for hand pose recorindg also
  // - conditions when to show
  // - add to dataset?
  const isTextInput = useSceneStore((s) => !!s.ds?.tokenizer)
  const getImageFromUrl = useImageFromUrl()
  const getTextInput = useTextInput()
  const cb = isTextInput ? getTextInput : getImageFromUrl
  return cb
}

function useImageFromUrl() {
  // const externalSamples = useSceneStore((s) => s.ds?.externalSamples)
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  const setSample = useSceneStore((s) => s.setSample)
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    async function loadExternalSample() {
      if (!url || !inputDims) return

      const image = new Image()
      image.crossOrigin = "anonymous"
      image.src = url

      await new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => resolve(image)
        image.onerror = reject
      })

      const [targetHeight, targetWidth] = inputDims

      const imgTensor = await tf.browser.fromPixelsAsync(image)
      const resized = tf.tidy(() =>
        centerCropResize(imgTensor, targetHeight, targetWidth).flatten()
      )
      try {
        const X = await resized.array()
        if (X) setSample({ X, index: Date.now() }, true)
      } finally {
        resized.dispose()
        imgTensor.dispose()
      }
    }
    loadExternalSample().catch((error) => {
      window.alert(`Failed to load image from URL: ${url}\nTry another`)
      console.error("Error loading external sample:", error)
    })
  }, [url, inputDims, setSample])
  const onBtnClick = useCallback(() => {
    const newUrl = window.prompt("Enter image URL:")
    if (newUrl) setUrl(newUrl)
  }, [])
  return onBtnClick
}

function useTextInput() {
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  const setSample = useSceneStore((s) => s.setSample)
  const tokenizer = useSceneStore((s) => s.ds?.tokenizer)
  const onBtnClick = useCallback(() => {
    const text = window.prompt("Enter some text:")
    const length = inputDims?.[0]
    const tokens = tokenizer?.encode(text ?? "", length)
    if (!tokens) return
    const newSample: SampleRaw = {
      X: tokens,
      index: Date.now(),
    }
    setSample(newSample, true)
  }, [inputDims, tokenizer, setSample])
  return onBtnClick
}
