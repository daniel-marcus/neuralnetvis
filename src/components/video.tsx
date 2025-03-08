"use client"

import { useCallback, useEffect } from "react"
import { useSceneStore } from "@/store"
import { useHandPose } from "@/data"
import { InlineButton } from "./ui-elements"
import { useCanvasUpdate } from "@/data/hand-pose"

export function VideoWindow({ isActive }: { isActive: boolean }) {
  const videoRef = useSceneStore((s) => s.videoRef)
  const canvasRef = useSceneStore((s) => s.canvasRef)
  const stream = useSceneStore((s) => s.stream)
  const isRecording = useSceneStore((s) => s.isRecording)
  useCanvasUpdate()
  return (
    <>
      {isActive && <VideoControl />}
      <div
        className={`absolute z-20 top-0 left-0 w-full h-full ${
          isRecording
            ? "backdrop-blur-sm backdrop-brightness-75 backdrop-grayscale-100"
            : ""
        } transition-all duration-300 pointer-events-none`}
      />
      <video
        ref={videoRef}
        className={`fixed top-[50%] -translate-y-1/2 scale-x-[-1] left-0 w-full pointer-events-none opacity-0 contrast-200 grayscale-100 ${
          stream ? "opacity-0" : "opacity-5"
        } transition-opacity duration-5000`}
        playsInline
      />
      <canvas
        ref={canvasRef}
        className={`fixed top-[50%] -translate-y-1/2 scale-x-[-1] left-0 w-full pointer-events-none ${
          stream ? "opacity-100 z-30" : "opacity-50 grayscale-100"
        }`}
      />
    </>
  )
}

function VideoControl() {
  const [stream, toggleStream] = useStream()
  const [isRecording, toggleRecording] = useHandPose(stream)
  const dsIsUserGenerated = useSceneStore((s) => s.ds?.isUserGenerated)
  return (
    <div
      className={`fixed z-50 left-0 top-[34px] sm:top-[102px] p-main flex gap-2 justify-end sm:justify-start w-full sm:w-auto`}
    >
      {!isRecording && (
        <InlineButton onClick={toggleStream}>
          {!!stream ? "stop" : "start"} video
        </InlineButton>
      )}
      {dsIsUserGenerated && !!stream && (
        <InlineButton
          onClick={toggleRecording}
          variant={isRecording ? "primary" : "secondary"}
        >
          {isRecording ? "cancel recording" : "record samples"}
        </InlineButton>
      )}
    </div>
  )
}

function useStream() {
  const videoRef = useSceneStore((s) => s.videoRef)
  const stream = useSceneStore((s) => s.stream)
  const setStream = useSceneStore((s) => s.setStream)
  const stopStream = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop())
    setStream(null)
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
