"use client"

import {
  Block,
  Button,
  OnBlockEnterLeaveProps,
  OnBlockScrollProps,
} from "@/components/lesson"
import { LessonContent } from "./all-lessons"
import { useEffect } from "react"
import { useController } from "@/components/controller"

export const IntroNetworks = (): LessonContent => {
  const controller = useController()
  useEffect(() => {
    console.log("IntroNetworks mounted")
  }, [])
  return (
    <main>
      <Block onScroll={rotate}>Just scroll and see what happens.</Block>
      <Block onScroll={changeSample}>
        Now let&apos;s change the sample as we scroll.
      </Block>
      <Block
        onScroll={changeLayerSpacing}
        onEnter={showModelTab}
        onLeave={hideModelTab}
      >
        Changing layerSpacing.
      </Block>
      <Block
        onScroll={changeNeuronSpacing}
        onEnter={showModelTab}
        onLeave={hideModelTab}
      >
        Changing neuronSpacing
      </Block>
      <Block>
        How about training?
        <br />
        <br />
        <Button onClick={() => startTraining(controller)}>Train!</Button>
      </Block>
    </main>
  )
}

function rotate({ three, percent }: OnBlockScrollProps) {
  if (!three) return
  const camera = three.camera
  function rotate(percent: number) {
    const angle = percent * Math.PI * 2 // Full rotation
    const radius = Math.sqrt(22.5 * 22.5 + 35 * 35) // Distance from origin
    camera.position.x = Math.sin(angle) * radius
    camera.position.z = Math.cos(angle) * radius
    camera.lookAt(0, 0, 0)
  }
  rotate(percent)
}

function changeSample({ dataStore, percent }: OnBlockScrollProps) {
  const newI = Math.round(percent * 100)
  dataStore.setValueAtPath("i", newI, false)
}

function changeLayerSpacing({ modelStore, percent }: OnBlockScrollProps) {
  const defaultSpacing = 11
  const scalingFactor = Math.sin(2 * Math.PI * percent) + 1
  const newSpacing = defaultSpacing * scalingFactor
  modelStore.setValueAtPath("visualization.layerSpacing", newSpacing, false)
}

function changeNeuronSpacing({ modelStore, percent }: OnBlockScrollProps) {
  const defaultSpacing = 1.1
  const scalingFactor = Math.sin(2 * Math.PI * percent) + 1
  const newSpacing = defaultSpacing * scalingFactor
  modelStore.setValueAtPath("visualization.neuronSpacing", newSpacing, false)
}

function showModelTab({ setTabByKey }: OnBlockEnterLeaveProps) {
  setTabByKey("model")
}

function hideModelTab({ setTabByKey }: OnBlockEnterLeaveProps) {
  setTabByKey(null)
}

function startTraining({
  trainConfigStore,
  setIsTraining,
  setTabByKey,
}: OnBlockEnterLeaveProps) {
  trainConfigStore.setValueAtPath("silent", false, false)
  setTabByKey("training")
  setIsTraining(true)
}
