import React, { useMemo, createContext, useContext } from "react"
import { Sequential } from "./sequential"
import * as tf from "@tensorflow/tfjs"
import { useControls } from "leva"
import { StatusTextContext } from "./app"
import { useTraining } from "@/lib/training"
import { useDatasets } from "@/lib/datasets"

interface Options {
  hideLines?: boolean
}

export const OptionsContext = createContext<Options>({})
export const TrainingLabelContext = createContext<number | undefined>(undefined)

export const Model = () => {
  const [input, label, next, ds] = useDatasets()
  const model = useModel()
  const isTraining = useTraining(model, input, next, ds)
  if (!model) return null
  return (
    <OptionsContext.Provider value={{ hideLines: isTraining }}>
      <TrainingLabelContext.Provider value={label}>
        <Sequential model={model} input={input} />
      </TrainingLabelContext.Provider>
    </OptionsContext.Provider>
  )
}

const defaultUnitConfig = {
  value: 32,
  min: 16,
  max: 256,
  step: 16,
  optional: true,
}

function useModel() {
  const config = useControls("model", {
    layer1: { ...defaultUnitConfig, value: 64 },
    layer2: { ...defaultUnitConfig, disabled: true },
    layer3: { ...defaultUnitConfig, disabled: true },
  }) as Record<string, number>

  const setStatusText = useContext(StatusTextContext)

  const model = useMemo(() => {
    // setIsTraining(false)
    const layerUnits = Object.keys(config)
      .map((key) => config[key] as number)
      .filter((l) => l)
    const _model = createModel(layerUnits)
    const totalParamas = _model.countParams()
    const text = `Sequential Model created<br/>
Input (784) | ${layerUnits
      .map((u) => `Dense (${u})`)
      .join(" | ")} | Output (10)<br/>
Params: ${totalParamas.toLocaleString("en-US")}`
    setStatusText(text)
    return _model
  }, [config, setStatusText])

  return model
}

function createModel(hiddenLayerUnits = [128, 64]) {
  const model = tf.sequential()
  model.add(tf.layers.inputLayer({ batchInputShape: [null, 784] }))
  for (const units of hiddenLayerUnits) {
    model.add(tf.layers.dense({ units, activation: "relu" }))
  }
  model.add(tf.layers.dense({ units: 10, activation: "softmax" }))
  return model
}
