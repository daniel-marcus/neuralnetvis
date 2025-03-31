"use client"

import { useCallback, useEffect } from "react"
import { useGlobalStore, useSceneStore } from "@/store"
import { useHandPose } from "@/data"
import { Button } from "./ui-elements"
import { useCanvasUpdate } from "@/data/hand-pose"

export function VideoWindow() {
  const videoRef = useSceneStore((s) => s.videoRef)
  const canvasRef = useSceneStore((s) => s.canvasRef)
  const stream = useSceneStore((s) => s.stream)
  useCanvasUpdate()
  return (
    <>
      <video
        ref={videoRef}
        className={`absolute top-[50%] -translate-y-1/2 scale-x-[-1] left-0 w-full pointer-events-none opacity-0 contrast-200 grayscale-100 ${
          stream ? "opacity-0" : "opacity-5"
        } transition-opacity duration-5000`}
        playsInline
      />
      <canvas
        ref={canvasRef}
        className={`absolute top-[50%] -translate-y-1/2 scale-x-[-1] left-0 w-full pointer-events-none ${
          stream ? "opacity-100 z-30" : "opacity-50 grayscale-100"
        }`}
      />
    </>
  )
}

// https://lucide.dev/icons/video
export const cameraSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="inline w-4 h-4"
  >
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
    <rect x="2" y="6" width="14" height="12" rx="2" />
  </svg>
)

const cameraOffSvg = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="inline w-4 h-4"
  >
    <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196" />
    <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2" />
    <path d="m2 2 20 20" />
  </svg>
)

export function VideoControl() {
  const [stream, toggleStream] = useStream()
  const [isRecording, toggleRecording] = useHandPose(stream)
  const dsIsUserGenerated = useSceneStore((s) => s.ds?.isUserGenerated)
  const setTab = useGlobalStore((s) => s.setTab)
  return (
    <>
      {!isRecording && (
        <Button onClick={toggleStream} className="h-6">
          {!!stream ? <>{cameraOffSvg} stop</> : <>{cameraSvg} start</>} video
        </Button>
      )}
      {!dsIsUserGenerated && (
        <Button onClick={() => setTab("data")} variant="secondary">
          new dataset
        </Button>
      )}
      {dsIsUserGenerated && !!stream && (
        <Button
          onClick={async () => toggleRecording()}
          variant={isRecording ? "primary" : "secondary"}
        >
          {isRecording ? "cancel recording" : "record samples"}
        </Button>
      )}
    </>
  )
}

function useStream() {
  const videoRef = useSceneStore((s) => s.videoRef)
  const stream = useSceneStore((s) => s.stream)
  const setStream = useSceneStore((s) => s.setStream)
  const stopStream = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop())
    setStream(undefined)
  }, [stream, setStream])
  const toggleStream = useCallback(async () => {
    if (stream) stopStream()
    else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      setStream(stream)
    }
  }, [stream, setStream, stopStream])
  useEffect(() => {
    const video = videoRef?.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(console.warn)
    return () => {
      video.srcObject = null
      stopStream()
    }
  }, [stream, videoRef, stopStream])
  return [stream, toggleStream, stopStream] as const
}
