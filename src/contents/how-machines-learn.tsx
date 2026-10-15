"use client"

import { useCurrScene } from "@/store"
import { LockButton } from "@/scene-views/3d-model/lock"
import { Block, Details, Head } from "@/contents/elements"
import { useScrollTraining } from "@/contents/elements/scroll-training"
import { interpolate } from "@/scene-views/3d-model/utils"
import { defaultVisConfig } from "@/store/vis"
import { getNid } from "@/neuron-layers/helpers"
import type { LessonContent } from "./types"
import type { InitialState } from "@/utils/initial-state"

export const hmlInitialState: InitialState = {
  layerConfigs: [{ className: "Dense", config: {} }], // output layer
  cameraPos: [-10, 0, -10],
  sampleIdx: 50,
  vis: {
    neuronSpacing: 2.2,
    xShift: 13,
    excludedLayers: ["nnv_Output"],
    showPointer: false,
  },
}

export const IntroNetworks = (): LessonContent => {
  const setVisConfig = useCurrScene((s) => s.vis.setConfig)
  const setSampleIdx = useCurrScene((s) => s.setSampleIdx)
  const setHoveredNid = useCurrScene((s) => s.setHoveredNid)
  const setSelectedNid = useCurrScene((s) => s.setSelectedNid)
  const training = useScrollTraining({ totalSamples: 300 })
  return (
    <main>
      <Head
        title="How do machines learn?"
        description="Let's train a neural network to recognize handwritten digits (test content)"
        cameraPos={hmlInitialState.cameraPos}
        onEnter={training.reset}
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
          training.reset()
          setSampleIdx(hmlInitialState.sampleIdx ?? 0)
          setVisConfig({
            excludedLayers: hmlInitialState.vis!.excludedLayers,
          })
        }}
      >
        This is a three, obviously.
      </Block>
      <Block
        cameraPos={[-25, 0, 40]}
        onEnter={() => {
          training.reset()
          setVisConfig({ excludedLayers: [] })
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
          training.reset()
          setVisConfig({ showPointer: false })
        }}
      >
        And connect every neuron from the input layer to our output layer neurons.
      </Block>
      <Block
        cameraPos={[-17, 0, 27]}
        onScroll={({ percent }) => {
          const sampleIdx = Math.round(percent * 100 + 1)
          setSampleIdx(sampleIdx)
        }}
        onEnter={() => {
          training.reset()
          setVisConfig({ showPointer: true })
        }}
      >
        Here comes: the pointer.
      </Block>
      <Block
        onScroll={training.onScroll}
        onEnter={() => {
          training.onEnter()
          setSelectedNid(getNid(2, 3))
        }}
        onLeave={() => {
          training.onLeave()
          setSelectedNid(undefined)
        }}
      >
        <p className="mb-[50vh]">We can even train the model as we scroll.</p>
        <p className="mb-[50vh]">Keep scrolling ...</p>
        <p className="mb-[50vh]">Just a little bit more ...</p>
      </Block>
      <Block onEnter={training.ensureTrained}>
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
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam scelerisque ligula nec
            orci tincidunt, non venenatis ligula posuere. Integer facilisis, tortor eget lobortis
            gravida, felis justo tristique elit, sit amet tempor dui purus sed justo. Vivamus in
            mauris ut sem vehicula viverra. Ut et arcu ac tortor malesuada mollis. Morbi sed nunc
            gravida, cursus felis nec, iaculis eros. Sed euismod bibendum sem, ac gravida velit
            facilisis ut. Nulla facilisi. Sed feugiat varius quam, in volutpat ante eleifend nec.
          </p>
        </Details>
      </Block>
    </main>
  )
}
