import { useCallback, useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { centerCropResize } from "./utils"

export function useExternalSample() {
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

      // TODO: async
      const X = tf.tidy(() => {
        const imgTensor = tf.browser.fromPixels(image)
        const resized = centerCropResize(imgTensor, targetHeight, targetWidth)
        return resized.flatten().arraySync()
      })

      if (X) setSample({ X, index: Date.now() }, true)
    }
    loadExternalSample().catch((error) => {
      window.alert(`Failed to load image from URL: ${url}\nTry another`)
      console.error("Error loading external sample:", error)
    })
  }, [url, inputDims, setSample])
  const onBtnClick = useCallback(() => {
    const newUrl = prompt("Enter image URL:")
    if (newUrl) setUrl(newUrl)
  }, [])
  return onBtnClick
}
