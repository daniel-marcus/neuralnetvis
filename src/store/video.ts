import { createRef, type RefObject } from "react"
import { StateCreator } from "zustand"

export interface VideoSlice {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  stream?: MediaStream
  setStream: (stream?: MediaStream) => void
  isRecording: boolean
  setIsRecording: (isRecording: boolean) => void
  recordingY: number | undefined
  setRecordingY: (y: number | undefined) => void
}

export const createVideoSlice: StateCreator<VideoSlice> = (set) => ({
  videoRef: createRef<HTMLVideoElement>(),
  canvasRef: createRef<HTMLCanvasElement>(),
  stream: undefined,
  setStream: (stream) => set({ stream }),
  isRecording: false,
  setIsRecording: (isRecording) => set({ isRecording }),
  recordingY: undefined,
  setRecordingY: (recordingY) => set({ recordingY }),
})
