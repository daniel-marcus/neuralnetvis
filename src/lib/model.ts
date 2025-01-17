import { useControls } from "leva"
import { Dataset } from "./datasets"
import { useStatusText } from "@/components/status-text"
import { useMemo } from "react"
import * as tf from "@tensorflow/tfjs"

const defaultUnitConfig = {
  value: 32,
  min: 16,
  max: 256,
  step: 16,
  optional: true,
}

export function useModel(ds: Dataset) {
  const config = useControls("model", {
    layer1: { ...defaultUnitConfig, value: 64 },
    layer2: { ...defaultUnitConfig, value: 32 },
    layer3: { ...defaultUnitConfig, disabled: true },
  }) as Record<string, number>

  const setStatusText = useStatusText((s) => s.setStatusText)

  const inputSize = ds.trainData[0]?.length ?? 0
  const model = useMemo(() => {
    const layerUnits = Object.keys(config)
      .map((key) => config[key] as number)
      .filter((l) => l)
    const _model = createModel(inputSize, layerUnits)
    const totalParamas = _model.countParams()
    const text = `${ds.name}: New Sequential Model created<br/>
Input (${inputSize}) | ${layerUnits
      .map((u) => `Dense (${u})`)
      .join(" | ")} | Output (10)<br/>
Params: ${totalParamas.toLocaleString("en-US")}`
    setStatusText(text)
    return _model
  }, [config, setStatusText, inputSize, ds.name])

  return model
}

function createModel(inputSize = 784, hiddenLayerUnits = [128, 64]) {
  const model = tf.sequential()
  model.add(tf.layers.inputLayer({ batchInputShape: [null, inputSize] }))
  for (const units of hiddenLayerUnits) {
    model.add(tf.layers.dense({ units, activation: "relu" }))
  }
  model.add(tf.layers.dense({ units: 10, activation: "softmax" }))
  return model
}
