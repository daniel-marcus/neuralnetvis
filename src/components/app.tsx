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
  useEffect(() => {
    async function initGPU() {
      await tf.setBackend("webgpu")
      const gpuDevice = tf.engine().registry.webgpu?.device as
        | GPUDevice
        | undefined
      // const adapter = await navigator.gpu?.requestAdapter()
      // const gpuDevice = await adapter?.requestDevice()
      console.log("GPU device", gpuDevice)
      useGlobalStore.setState({ gpuDevice })
    }
    initGPU()
  }, [])
}
