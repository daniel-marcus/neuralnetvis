import { useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { useSceneStore } from "@/store"
import { Button, Select } from "@/components/ui-elements"

export function ExternalSampleSelect() {
  const externalSamples = useSceneStore((s) => s.ds?.externalSamples)
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

      // TODO: crop // async
      const X = tf.tidy(() => {
        const imageTensor = tf.browser.fromPixels(image)
        const [height, width, channels] = imageTensor.shape
        const cropSize = Math.min(height, width)
        const offsetHeight = Math.floor((height - cropSize) / 2)
        const offsetWidth = Math.floor((width - cropSize) / 2)

        const cropped = tf.slice(
          imageTensor,
          [offsetHeight, offsetWidth, 0],
          [cropSize, cropSize, channels]
        )

        return tf.image
          .resizeBilinear(cropped, [targetHeight, targetWidth])
          .flatten()
          .arraySync()
      })

      if (X) setSample({ X, index: Date.now() })
    }
    loadExternalSample().catch((error) => {
      window.alert(`Failed to load image from URL: ${url}\nTry another`)
      console.error("Error loading external sample:", error)
    })
  }, [url, inputDims, setSample])
  if (!externalSamples || externalSamples.length === 0) return null
  const onBtnClick = () => {
    const newUrl = prompt("Enter image URL:")
    if (newUrl) setUrl(newUrl)
  }
  return (
    <div className="flex justify-center items-center gap-2">
      <Select
        value={url}
        options={externalSamples.map((s) => ({ value: s.url, label: s.label }))}
        onChange={(val) => setUrl(val as string)}
      />
      <Button variant="secondary" onClick={onBtnClick}>
        From URL ...
      </Button>
    </div>
  )
}
