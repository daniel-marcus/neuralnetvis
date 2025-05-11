"use client"

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
      const adapter = await navigator.gpu?.requestAdapter()
      const device = await adapter?.requestDevice()
      useGlobalStore.setState({ gpuDevice: device })
    }
    initGPU()
  }, [])
}
