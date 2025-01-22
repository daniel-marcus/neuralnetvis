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

export function useModel(ds?: Dataset) {
  const modelConfig = useControls("model", {
    layer1: { ...defaultUnitConfig, value: 64 },
    layer2: { ...defaultUnitConfig, value: 32 },
    layer3: { ...defaultUnitConfig, disabled: true },
  }) as Record<string, number>

  const setStatusText = useStatusText((s) => s.setStatusText)

  const model = useMemo(() => {
    if (!ds) return
    const [totalSamples, ...dims] = ds.data.trainX.shape

    const flattenedInputSize = dims.reduce((a, b) => a * b, 1)

    const inputShape = [null, ...dims]

    const hiddenLayerUnits = Object.keys(modelConfig)
      .map((key) => modelConfig[key] as number)
      .filter((l) => l)
    const _model = createModel(inputShape, hiddenLayerUnits, ds.output)
    const totalParamas = _model.countParams()
    const text = `New Model: Sequential (${totalParamas.toLocaleString(
      "en-US"
    )} params)<br/>
Input (${flattenedInputSize}) | Flatten | ${hiddenLayerUnits
      .map((u) => `Dense (${u})`)
      .join(" | ")} | Output (10)<br/>
Dataset: ${ds.name} (${totalSamples.toLocaleString("en-US")} samples)<br/>`
    setStatusText(text)
    return _model
  }, [modelConfig, setStatusText, ds])

  return model
}

function createModel(
  inputShape: (number | null)[],
  hiddenLayerUnits = [128, 64],
  output: Dataset["output"]
) {
  const model = tf.sequential()
  model.add(tf.layers.inputLayer({ batchInputShape: inputShape }))
  model.add(tf.layers.flatten())
  for (const units of hiddenLayerUnits) {
    model.add(tf.layers.dense({ units, activation: "relu" }))
  }
  model.add(
    tf.layers.dense({ units: output.size, activation: output.activation })
  )
  return model
}
