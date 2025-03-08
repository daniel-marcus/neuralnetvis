import { createRef, type RefObject } from "react"
import { StateCreator } from "zustand"

export interface VideoSlice {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  stream: MediaStream | null
  setStream: (stream: MediaStream | null) => void
  isRecording: boolean
  startRecording: () => void
  stopRecording: () => void
}

export const createVideoSlice: StateCreator<VideoSlice> = (set) => ({
  videoRef: createRef<HTMLVideoElement>(),
  canvasRef: createRef<HTMLCanvasElement>(),
  stream: null,
  setStream: (stream) => set({ stream }),
  isRecording: false,
  startRecording: () => set({ isRecording: true }),
  stopRecording: () => set({ isRecording: false }),
})
