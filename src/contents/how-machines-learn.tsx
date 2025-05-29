"use client"

import { useCurrScene, useGlobalStore } from "@/store"
import { setStatus, clearStatus, getThree } from "@/store"
import { LockButton } from "@/scene-views/3d-model/lock"
import { Block, Details, Head } from "@/contents/elements"
import { trainOnBatch } from "@/model/training"
import { interpolate } from "@/scene-views/3d-model/utils"
import { defaultVisConfig } from "@/store/vis"
import { getNid } from "@/neuron-layers/neurons"
import type { OnScrollProps } from "@/contents/elements/types"
import type { LessonContent } from "."
import type { InitialState } from "@/utils/initial-state"

export const hmlInitialState: InitialState = {
  layerConfigs: [{ className: "Dense", config: {} }], // output layer
  cameraPos: [-10, 0, -10],
  sampleIdx: 50,
  vis: {
    neuronSpacing: 2.2,
    xShift: 13,
    invisibleLayers: ["nnv_Output"],
    showPointer: false,
    highlightProp: null,
  },
}

const SCROLL_TRAIN_STATUS_ID = "scroll-train-status"

export const IntroNetworks = (): LessonContent => {
  const setVisConfig = useCurrScene((s) => s.vis.setConfig)
  const setSampleIdx = useCurrScene((s) => s.setSampleIdx)
  const setHoveredNid = useCurrScene((s) => s.setHoveredNid)
  const setSelectedNid = useCurrScene((s) => s.setSelectedNid)
  return (
    <main>
      <Head
        title="How do machines learn?"
        description="Let's train a neural network to recognize handwritten digits (test content)"
        cameraPos={hmlInitialState.cameraPos}
        onScroll={({ percent }) => {
          const initSpacing = hmlInitialState.vis!.neuronSpacing!
          const dflt = defaultVisConfig.neuronSpacing!
          const neuronSpacing = interpolate(initSpacing, dflt, percent)
          setVisConfig({ neuronSpacing })
        }}
      />
      <Block
        cameraPos={[-60, 0, 30]}
        onEnter={() => {
          setSampleIdx(hmlInitialState.sampleIdx ?? 0)
          setVisConfig({
            invisibleLayers: hmlInitialState.vis!.invisibleLayers,
          })
        }}
      >
        This is a three, obviously.
      </Block>
      <Block
        cameraPos={[-25, 0, 40]}
        onEnter={() => {
          setVisConfig({ invisibleLayers: [] })
        }}
      >
        Let&apos;s add our output layer.
      </Block>
      <Block
        cameraPos={[0, 0, 40]}
        onScroll={({ percent }) => {
          const idx = Math.round(percent * 9)
          const nid = getNid(2, idx)
          setHoveredNid(nid)
        }}
        onLeave={() => {
          setHoveredNid(undefined)
        }}
        onEnter={() => {
          setVisConfig({ showPointer: false })
        }}
      >
        And connect every neuron from the input layer to our output layer
        neurons.
      </Block>
      <Block
        cameraPos={[-17, 0, 27]}
        onScroll={({ percent }) => {
          const sampleIdx = Math.round(percent * 100 + 1)
          setSampleIdx(sampleIdx)
        }}
        onEnter={() => setVisConfig({ showPointer: true })}
      >
        Here comes: the pointer.
      </Block>
      <Block
        onScroll={scrollTrain}
        onEnter={() => {
          setVisConfig({ highlightProp: "weights" })
          setSelectedNid(getNid(2, 2))
        }}
        onLeave={() => {
          clearStatus(SCROLL_TRAIN_STATUS_ID)
          setVisConfig({ highlightProp: null })
          setSelectedNid(undefined)
        }}
      >
        <p className="mb-[50vh]">We can even train the model as we scroll.</p>
        <p className="mb-[50vh]">Keep scrolling ...</p>
        <p className="mb-[50vh]">Just a little bit more ...</p>
      </Block>
      <Block>
        Try out!
        <br />
        <br />
        <LockButton />
      </Block>
      <Block>
        What do you think?
        <br />
        <Details title="How does that work?">
          <p>Here is some extra content.</p>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam
            scelerisque ligula nec orci tincidunt, non venenatis ligula posuere.
            Integer facilisis, tortor eget lobortis gravida, felis justo
            tristique elit, sit amet tempor dui purus sed justo. Vivamus in
            mauris ut sem vehicula viverra. Ut et arcu ac tortor malesuada
            mollis. Morbi sed nunc gravida, cursus felis nec, iaculis eros. Sed
            euismod bibendum sem, ac gravida velit facilisis ut. Nulla facilisi.
            Sed feugiat varius quam, in volutpat ante eleifend nec.
          </p>
        </Details>
      </Block>
    </main>
  )
}

export function rotate({ percent }: OnScrollProps) {
  const three = getThree()
  if (!three) return
  const camera = three.camera
  function rotate(percent: number) {
    const angle = percent * Math.PI * 2 // Full rotation
    const radius = Math.sqrt(22.5 * 22.5 + 35 * 35) // Distance from origin
    camera.position.x = Math.sin(angle) * radius
    camera.position.z = Math.cos(angle) * radius
    camera.lookAt(0, 0, 0)
    three?.invalidate()
  }
  rotate(percent)
}

let batch = 0
const trainedIs = new Set<number>()

function getRandomI(totalSamples: number) {
  let i = Math.round(Math.random() * totalSamples - 1)
  while (trainedIs.has(i)) {
    i = Math.round(Math.random() * totalSamples - 1)
  }
  trainedIs.add(i)
  return i
}

async function scrollTrain({ percent }: OnScrollProps) {
  const scene = useGlobalStore.getState().scene
  const totalSamples = scene.getState().totalSamples()
  const sampleIdx = getRandomI(totalSamples)
  batch++
  scene.setState({ sampleIdx })

  const sample = scene.getState().sample
  if (!sample || typeof sample.y !== "number") return
  const log = await trainOnBatch([sample.xTensor], [sample.y])

  if (!log) return
  scene.getState().addLog({ ...log, epoch: 0, batch })
  setStatus(`Training loss: ${log.loss.toFixed(2)}`, percent, {
    id: SCROLL_TRAIN_STATUS_ID,
  })
}
