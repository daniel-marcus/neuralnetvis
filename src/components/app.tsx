"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import React, { ReactNode } from "react"
import { Model } from "../three/model"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"
import { useModel } from "@/lib/model"
import { Menu } from "./menu"
import { Footer } from "./footer"
import { ThreeStoreSetter } from "@/three/three-store"
import { useLockStore } from "./lock"
import { Gradient } from "./gradient"
import { DebugUtils } from "@/three/debug-utils"
import { Lights } from "@/three/lights"

export const App = ({ children }: { children?: ReactNode }) => {
  const [ds, next] = useDatasets()
  const [model, isPending] = useModel(ds)
  const [, batchCount] = useTraining(model, ds, next)
  const visualizationLocked = useLockStore((s) => s.visualizationLocked)
  return (
    <div className="relative">
      <div
        className={`fixed top-0 left-0 z-0 w-screen h-[100dvh] bg-background select-none overflow-hidden ${
          visualizationLocked ? "pointer-events-none" : ""
        }`}
      >
        <Canvas frameloop="demand">
          <Lights />
          <PerspectiveCamera makeDefault position={[-22.5, 0, 35]} />
          <OrbitControls target={[0, 0, 0]} enabled={!visualizationLocked} />
          <Model model={model} batchCount={batchCount} isPending={isPending} />
          <ThreeStoreSetter />
          <DebugUtils />
        </Canvas>
        <Footer />
      </div>
      <Gradient />
      <Menu />
      {children}
    </div>
  )
}
