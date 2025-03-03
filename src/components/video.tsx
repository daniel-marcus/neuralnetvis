import { useCallback, useEffect } from "react"
import { useStore } from "@/store"
import { useHandPose } from "@/data"
import { InlineButton } from "./ui-elements"

export function VideoWindow() {
  const videoRef = useStore((s) => s.videoRef)
  const canvasRef = useStore((s) => s.canvasRef)
  const stream = useStore((s) => s.stream)
  const isTraining = useStore((s) => s.isTraining)
  return (
    <>
      <VideoControl />
      <video
        ref={videoRef}
        className={`fixed top-[50dvh] -translate-y-1/2 scale-x-[-1] left-0 w-full pointer-events-none opacity-0 contrast-200 grayscale-100 ${
          stream ? "opacity-0" : "opacity-5"
        } transition-opacity duration-5000`}
        playsInline
      />
      <canvas
        ref={canvasRef}
        className={`fixed top-[50dvh] -translate-y-1/2 scale-x-[-1] left-0 w-full pointer-events-none ${
          stream && !isTraining
            ? "opacity-100 z-30"
            : "opacity-40 grayscale-100"
        }`}
      />
    </>
  )
}

function VideoControl() {
  const [stream, toggleStream] = useStream()
  const [isRecording, toggleRecording] = useHandPose(stream)
  const dsIsUserGenerated = useStore((s) => s.ds?.isUserGenerated)
  return (
    <div
      className={`fixed z-10 left-0 top-[34px] sm:top-[102px] p-main flex gap-2 justify-end sm:justify-start w-full sm:w-auto`}
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
  const videoRef = useStore((s) => s.videoRef)
  const stream = useStore((s) => s.stream)
  const stopStream = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop())
    useStore.setState({ stream: null })
  }, [stream])
  const toggleStream = useCallback(async () => {
    if (stream) stopStream()
    else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      useStore.setState({ stream })
    }
  }, [stream, stopStream])
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
  return [stream, toggleStream] as const
}
