"use client"

import * as tf from "@tensorflow/tfjs"
import { useTfBackend } from "@/model/tf-backend"
import { useDebugCommands, useScreenshotBodyClass } from "@/utils/debug"
import { Header } from "./header"
import { TileGrid } from "./tile-grid"
import { StatusBar } from "./status-bar"
import { LessonOverlayPortal } from "./lesson"
import { useEffect } from "react"
import { useGlobalStore } from "@/store"

export const App = ({ children }: { children?: React.ReactNode }) => {
  useTfBackend()
  useGPUDevice()
  useDebugCommands()
  useScreenshotBodyClass()
  return (
    <>
      <Header />
      <LessonOverlayPortal />
      <TileGrid />
      {children}
      <StatusBar />
    </>
  )
}

function useGPUDevice() {
  const backendReady = useGlobalStore((s) => s.backendReady)
  useEffect(() => {
    if (!backendReady) return
    async function initGPU() {
      // share webgpu device between tfjs and threejs to allow direct GPU-to-GPU transfer
      const webGpuBackend = tf.engine().registry.webgpu
      const gpuDevice =
        !!webGpuBackend && "device" in webGpuBackend
          ? (webGpuBackend.device as GPUDevice)
          : undefined
      useGlobalStore.setState({ gpuDevice })
    }
    initGPU()
  }, [backendReady])
}
