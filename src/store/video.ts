import { StateCreator } from "zustand"

export interface VideoSlice {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
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

function createRef<T>(): React.RefObject<T | null> {
  return { current: null }
}
