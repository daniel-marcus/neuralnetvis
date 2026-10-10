import { useEffect, useMemo, useState } from "react"
import { useSceneStore } from "@/store"
import { getReceptiveField } from "@/model/feature-vis"
import { getTopSamples } from "@/model/top-samples"
import { AsciiProgress, ViewerSlot } from "./viewer-slot"
import { ImageCanvas } from "./image-canvas"
import type { LayersModel } from "@tensorflow/tfjs"
import type { TopSample } from "@/model/top-samples"
import type { NeuronStateful } from "@/neuron-layers/types"

export const MIN_SAMPLES = 50 // top samples of a handful of samples don't say much

const SCAN_DELAY = 300 // ms, hovered neurons change quickly

type CacheKey = string // `${ds.key}_${subset}_${totalSamples}_${nid}`

// reset when the weights change (training)
const topSamplesCache = new WeakMap<LayersModel, Map<CacheKey, TopSample[]>>()

function useTopSamples(neuron: NeuronStateful) {
  const model = useSceneStore((s) => s.model)
  const ds = useSceneStore((s) => s.ds)
  const subset = useSceneStore((s) => s.subset)
  const isTraining = useSceneStore((s) => s.isTraining)
  const [current, setCurrent] = useState<{
    key: CacheKey
    samples: TopSample[]
    progress: number
  }>()
  const { nid, index } = neuron
  const { tfLayer } = neuron.layer
  const key: CacheKey = `${ds?.key}_${subset}_${ds?.[subset].totalSamples}_${nid}`
  useEffect(() => {
    if (!model || !ds) return
    if (isTraining) {
      topSamplesCache.delete(model)
      return
    }
    if (topSamplesCache.get(model)?.has(key)) return
    let aborted = false
    const timeout = setTimeout(async () => {
      const samples = await getTopSamples(model, tfLayer, index, ds, subset, {
        shouldAbort: () => aborted,
        onProgress: (progress, preview) =>
          !aborted && setCurrent({ key, samples: preview, progress }),
      })
      if (!samples || aborted) return
      if (!topSamplesCache.has(model)) topSamplesCache.set(model, new Map())
      topSamplesCache.get(model)!.set(key, samples)
      setCurrent({ key, samples, progress: 1 })
    }, SCAN_DELAY)
    return () => {
      aborted = true
      clearTimeout(timeout)
    }
  }, [model, ds, subset, isTraining, key, index, tfLayer])
  const cached = model ? topSamplesCache.get(model)?.get(key) : undefined
  if (cached) return { samples: cached, progress: 1 }
  return current?.key === key ? current : { samples: [], progress: 0 }
}

// samples from the dataset that activate the neuron the most, cropped to its receptive field
export const TopSamplesViewer = ({ neuron }: { neuron: NeuronStateful }) => {
  const { samples, progress } = useTopSamples(neuron)
  const inputDims = useSceneStore((s) => s.ds?.inputDims)
  const currSampleIdx = useSceneStore((s) => s.sampleIdx)
  const setSampleIdx = useSceneStore((s) => s.setSampleIdx)
  const { tfLayer } = neuron.layer
  const crop = useMemo(
    () => inputDims && getReceptiveField(tfLayer, neuron.index, inputDims),
    [tfLayer, neuron.index, inputDims],
  )
  return (
    <ViewerSlot footer={progress < 1 && <AsciiProgress progress={progress} />}>
      <div className="w-full self-stretch grid grid-cols-3 grid-rows-3 gap-1">
        {!!inputDims &&
          samples.map(({ sampleIdx, X }) => (
            <button
              key={sampleIdx}
              className={`relative min-h-0 border ${
                sampleIdx === currSampleIdx ? "border-marker" : "border-transparent"
              } hover:border-white`}
              title={`#${sampleIdx}`}
              onClick={() => setSampleIdx(sampleIdx)}
            >
              <ImageCanvas
                data={X}
                shape={inputDims}
                maxValue={255}
                crop={crop}
                className="absolute inset-0 w-full h-full object-contain"
              />
            </button>
          ))}
      </div>
    </ViewerSlot>
  )
}
