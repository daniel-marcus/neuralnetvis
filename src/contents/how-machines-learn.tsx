"use client"

import { useCurrScene } from "@/store"
import { LockButton } from "@/scene-views/3d-model/lock"
import { Block, Details, Head, Prediction } from "@/contents/elements"
import { useScrollTraining } from "@/contents/elements/scroll-training"
import { DrawArea } from "@/data/draw-area"
import { interpolate } from "@/scene-views/3d-model/utils"
import { defaultVisConfig } from "@/store/vis"
import { getNid } from "@/neuron-layers/helpers"
import type { LessonContent } from "./types"
import type { Nid } from "@/neuron-layers/types"
import type { NeuronView } from "@/store/neurons"
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
    viewShift: 0.22, // make room for the text on the left
  },
  trainConfig: { learningRate: 0.01 }, // weights should visibly change after a few hundred samples
}

const OUTPUT_LAYER_IDX = 2
const THREE_NID = getNid(OUTPUT_LAYER_IDX, 3) // output neuron for the digit "3"
const sweepNid = (percent: number) => getNid(OUTPUT_LAYER_IDX, Math.round(percent * 9))

interface BlockSetup {
  outputLayer?: boolean
  pointer?: boolean
  selected?: Nid
  neuronView?: NeuronView
}

export const IntroNetworks = (): LessonContent => {
  const setVisConfig = useCurrScene((s) => s.vis.setConfig)
  const setSampleIdx = useCurrScene((s) => s.setSampleIdx)
  const setHoveredNid = useCurrScene((s) => s.setHoveredNid)
  const setSelectedNid = useCurrScene((s) => s.setSelectedNid)
  const setNeuronView = useCurrScene((s) => s.setNeuronView)
  const training = useScrollTraining({ totalSamples: 300 })
  const initialSample = () => setSampleIdx(hmlInitialState.sampleIdx ?? 0)
  // each block sets its complete state: blocks can be skipped with fast scrolling or scrolled in both directions
  const setup = ({ outputLayer = true, pointer = false, selected, neuronView }: BlockSetup) => {
    setVisConfig({ excludedLayers: outputLayer ? [] : ["nnv_Output"], showPointer: pointer })
    setHoveredNid(undefined)
    setSelectedNid(selected)
    if (neuronView) setNeuronView(neuronView)
  }
  return (
    <main>
      <Head
        title="How do machines learn?"
        description="Let's teach a neural network to recognize handwritten digits. (WIP)"
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
          initialSample()
          setup({ outputLayer: false })
        }}
      >
        <p>This is a 3, obviously. But how would a machine know?</p>
        <p>
          To a computer, the image is just a grid of 28 × 28 = 784 pixels. Each pixel becomes a{" "}
          <em>neuron</em> in the <em>input layer</em>, and its brightness is the neuron&apos;s{" "}
          <em>activation</em>.
        </p>
      </Block>
      <Block
        cameraPos={[-25, 0, 40]}
        onEnter={() => {
          training.reset()
          initialSample()
          setup({})
        }}
      >
        <p>
          We want the machine to give us an answer. So we add an <em>output layer</em> with 10
          neurons, one for each digit from 0 to 9. The neuron with the highest activation will be
          the machine&apos;s answer.
        </p>
      </Block>
      <Block
        cameraPos={[0, 0, 40]}
        onEnter={() => {
          training.reset()
          initialSample()
          setup({})
        }}
        onScroll={({ percent }) => setHoveredNid(sweepNid(percent))}
        onLeave={() => setHoveredNid(undefined)}
      >
        <p>
          How does the input get to the output? Each output neuron is connected to every single
          input neuron: 784 connections per output neuron, 7,840 in total.
        </p>
      </Block>
      <Block
        cameraPos={[-17, 0, 27]}
        onEnter={() => {
          training.reset()
          initialSample()
          setup({ selected: THREE_NID, neuronView: "weights" })
        }}
      >
        <p>
          Every connection has a <em>weight</em>: a number that says how much an input pixel matters
          for the output neuron, and whether it speaks for (positive) or against (negative) the
          neuron&apos;s digit.
        </p>
        <p>
          In the bottom left, you see the weights of the &quot;3&quot; neuron, arranged like the
          input image. Our model hasn&apos;t learned anything yet, so its weights are just random
          numbers: noise.
        </p>
      </Block>
      <Block
        onEnter={() => {
          training.reset()
          initialSample()
          setup({ pointer: true, selected: THREE_NID, neuronView: "weightedInputs" })
        }}
      >
        <p>
          To get its score, a neuron multiplies each pixel&apos;s brightness with the
          connection&apos;s weight and adds everything up. You see these <em>weighted inputs</em> in
          the bottom left now.
        </p>
        <p>
          All 10 output neurons calculate their score this way, and the highest score wins. The
          pointer marks the correct answer. And our untrained model says: <Prediction />. If
          that&apos;s right, it&apos;s pure luck.
        </p>
      </Block>
      <Block
        onScroll={training.onScroll}
        onEnter={() => {
          training.onEnter()
          setup({ pointer: true, selected: THREE_NID, neuronView: "weights" })
        }}
        onLeave={training.onLeave}
      >
        <p className="mb-[50vh]">
          So how do we find better weights? We don&apos;t set them by hand. Instead, we show the
          model lots of examples and let it learn from its mistakes. This is called{" "}
          <em>training</em>.
        </p>
        <div className="mb-[50vh]">
          <p>
            For each example, the model makes a guess. We compare it with the correct answer and
            nudge all weights a tiny bit, so that the score of the right neuron goes up and the
            others go down. The <em>loss</em> in the bottom right tells us how wrong the model still
            is.
          </p>
          <Details title="How does the nudging work?">
            <p>
              After each example, we measure how wrong the model was: the loss. Then we ask, for
              every single weight: &quot;If this weight were a tiny bit larger, would the loss go up
              or down?&quot;
            </p>
            <p>
              Calculus answers this question for all weights at once, working backwards from the
              output to the input. That&apos;s why it&apos;s called <em>backpropagation</em>. Each
              weight then takes a tiny step in the direction that reduces the loss. Repeat this
              thousands of times, and the weights slowly turn into something useful.
            </p>
          </Details>
        </div>
        <p className="mb-[50vh]">
          Keep scrolling to train the model, and watch the weights of the &quot;3&quot; neuron ...
        </p>
        <p className="mb-[50vh]">... does it look familiar?</p>
      </Block>
      <Block
        onEnter={() => {
          training.ensureTrained().then(initialSample)
          setup({ pointer: true, selected: THREE_NID, neuronView: "weights" })
        }}
      >
        <p>
          The weights of the &quot;3&quot; neuron now look like a blurry 3: positive where a 3
          usually has ink, negative where other digits have ink instead.
        </p>
        <p>
          Remember our 3 from the beginning? After a few hundred examples, the model says:{" "}
          <Prediction />. Not bad for a model that started with random numbers!
        </p>
      </Block>
      <Block
        onEnter={() => {
          training.ensureTrained()
          setup({ neuronView: "weights" })
        }}
        onScroll={({ percent }) => setSelectedNid(sweepNid(percent))}
        onLeave={() => setSelectedNid(undefined)}
      >
        <p>
          And it&apos;s not just the 3: every output neuron has learned its own template for its
          digit.
        </p>
      </Block>
      <Block
        onEnter={() => {
          training.ensureTrained()
          setup({})
        }}
      >
        <p>Now it&apos;s your turn: draw a digit and see what the model thinks.</p>
        <DrawArea autoHide={false} />
        <p>
          The model says: <Prediction />
        </p>
        <p>
          Don&apos;t be disappointed if it gets things wrong. Our model just compares your drawing
          with its 10 templates. If your digit is a bit shifted, thinner or tilted, the templates
          don&apos;t match anymore.
        </p>
      </Block>
      <Block>
        <p>
          To recognize digits more reliably, a model has to understand <em>shapes</em> rather than
          single pixels: lines, curves, loops. That&apos;s what <em>hidden layers</em> are for, and
          they&apos;re the topic of the next lesson (coming soon).
        </p>
        <p>Until then, feel free to explore the model on your own.</p>
        <LockButton />
      </Block>
    </main>
  )
}
