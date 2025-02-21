import { useCallback, useEffect, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import { useStore } from "@/store"

export function VideoTest() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  async function toggleStream() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
      setStream(stream)
    }
  }

  const updateSample = useCallback(async () => {
    if (!stream) return
    const video = videoRef.current
    if (!video) return
    const ds = useStore.getState().ds
    const inputLayer = useStore.getState().layerConfigs[0]
    if (!inputLayer || !ds) return
    const [, height, width, channels] =
      (inputLayer.config.batchInputShape as number[]) || ds.train.shapeX
    const isMonochrome = channels === 1
    const X = tf.tidy(() => {
      if (!video) return
      if (video.videoWidth === 0) return
      const image = tf.browser.fromPixels(video)

      const minDim = Math.min(image.shape[0], image.shape[1])
      const offsetX = (image.shape[1] - minDim) / 2
      const offsetY = (image.shape[0] - minDim) / 2

      const _cropped = image.slice([offsetY, offsetX, 0], [minDim, minDim, 3])

      const cropped = isMonochrome ? convertToMonochrome(_cropped) : _cropped

      const downscaled = tf.image.resizeBilinear(cropped, [height, width])
      return downscaled.div(255).flatten().arraySync()
    })
    if (!X) return
    const sample = { X, y: 0 }
    useStore.setState({ sample })
  }, [stream])

  useEffect(() => {
    if (!stream) return
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    video.play()
    let animationFrame: number
    captureLoop()
    async function captureLoop() {
      updateSample()
      animationFrame = requestAnimationFrame(captureLoop)
    }

    return () => {
      cancelAnimationFrame(animationFrame)
      video.srcObject = null
    }
  }, [stream, updateSample])

  return (
    <div className="fixed left-4 top-[50dvh] -translate-y-1/2">
      <div className="flex gap-4">
        <button onClick={toggleStream}>
          {!!stream ? "Stop" : "Start"} Video Input
        </button>
      </div>
      <div className="hidden h-[20vh] w-[20vh] border-2 border-accent">
        <video ref={videoRef} className="w-full h-full object-cover" />
      </div>
    </div>
  )
}

function convertToMonochrome<T extends tf.Tensor>(imageTensor: T): T {
  return tf.tidy(() => {
    const [r, g, b] = tf.split(imageTensor, 3, 2)
    // Apply the luminance formula: grayscale = 0.2989 * R + 0.587 * G + 0.114 * B
    const grayscale = r.mul(0.2989).add(g.mul(0.587)).add(b.mul(0.114))
    return grayscale as T
  })
}
