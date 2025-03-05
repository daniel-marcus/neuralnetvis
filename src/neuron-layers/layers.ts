import { useStatelessLayers } from "./layers-stateless"
import { useActivations } from "@/model/activations"
import { useWeights } from "@/model/weights"
import { useStatefulLayers } from "./layers-stateful"
import { useNeuronSelect } from "./neuron-select"
import { useStore } from "@/store"
import { Dataset, DatasetDef, Sample } from "@/data"
import { usePreviewModel } from "@/model/model"
import { useEffect, useState } from "react"
import { getPreprocessedSample } from "@/data/sample"
import { getDsFromDef } from "@/data/dataset"

export function useLayers(isPreview?: boolean, dsDef?: DatasetDef) {
  const globalDs = useStore((s) => s.ds)
  const globalModel = useStore((s) => s.model)
  const globalSample = useStore((s) => s.sample)

  const previewModel = usePreviewModel(dsDef)
  const model = isPreview ? previewModel : globalModel
  const previewSample = usePreviewSample(dsDef)
  const sample = isPreview ? previewSample : globalSample

  const _lyrs = useStatelessLayers(model, dsDef ?? globalDs)
  const activations = useActivations(model, sample?.X)
  const weights = useWeights(model)
  const _layers = useStatefulLayers(_lyrs, activations, weights, sample?.rawX)
  const layers = useNeuronSelect(!isPreview, _layers)
  return layers
}

function usePreviewSample(dsDef?: DatasetDef) {
  const [sample, setSample] = useState<Sample | undefined>(undefined)
  const ds = usePreviewDs(dsDef)
  // TODO: use locally scoped sampleIdx
  const sampleIdx = useStore((s) => s.sampleIdx)
  useEffect(() => {
    async function loadSample() {
      if (!ds) return
      const sample = await getPreprocessedSample(ds, sampleIdx)
      setSample(sample)
    }
    loadSample()
  }, [ds, sampleIdx])
  return sample
}

function usePreviewDs(dsDef?: DatasetDef) {
  const [ds, setDs] = useState<Dataset | undefined>(undefined)
  useEffect(() => {
    // TODO !!
    async function loadDs() {
      if (!dsDef) return
      const ds = await getDsFromDef(dsDef, true)
      setDs(ds)
    }
    loadDs()
  }, [dsDef])
  return ds
}
