"use client"

import React, { ReactNode } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { useTraining } from "@/tf/training"
import { useDatasets } from "@/data/datasets"
import { useModel } from "@/tf/model"
import { useLockStore } from "./lock"
import { Model, Lights, DebugUtils, ThreeStoreSetter } from "@/three"
import { VisWrapper } from "./vis-wrapper"
import { Menu } from "./menu"
import { Footer } from "./footer"
import { Gradient } from "./gradient"
import { useInput } from "@/data/input"

export const App = ({ children }: { children?: ReactNode }) => {
  const ds = useDatasets()
  useInput(ds)
  const [model, isPending] = useModel(ds)
  const [, batchCount] = useTraining(model, ds)
  const visualizationLocked = useLockStore((s) => s.visualizationLocked)
  return (
    <div>
      <VisWrapper>
        <Canvas frameloop="demand">
          <Lights />
          <PerspectiveCamera makeDefault position={[-23.5, 0, 35]} />
          <OrbitControls target={[0, 0, 0]} enabled={!visualizationLocked} />
          <Model model={model} batchCount={batchCount} isPending={isPending} />
          <ThreeStoreSetter />
          <DebugUtils />
        </Canvas>
        <Footer />
      </VisWrapper>
      <Gradient />
      <Menu />
      {children}
    </div>
  )
}
