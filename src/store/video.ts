import { createRef, type RefObject } from "react"
import { StateCreator } from "zustand"

export interface VideoSlice {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  stream?: MediaStream
  setStream: (stream?: MediaStream) => void
  isRecording: boolean
  startRecording: () => void
  stopRecording: () => void
  toggleRecording: () => void
  recordingY: RefObject<number | null>
}

export const createVideoSlice: StateCreator<VideoSlice> = (set) => ({
  videoRef: createRef<HTMLVideoElement>(),
  canvasRef: createRef<HTMLCanvasElement>(),
  stream: undefined,
  setStream: (stream) => set({ stream }),
  isRecording: false,
  startRecording: () => set({ isRecording: true }),
  stopRecording: () => set({ isRecording: false }),
  toggleRecording: () => set((state) => ({ isRecording: !state.isRecording })),
  recordingY: createRef<number | null>(),
})
