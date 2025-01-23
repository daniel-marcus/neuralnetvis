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
    conv2d: {
      value: 4,
      min: 1,
      max: 16,
      step: 1,
      optional: true,
      disabled: true,
    },
    dense1: { ...defaultUnitConfig, value: 64 },
    dense2: { ...defaultUnitConfig, value: 32, disabled: true },
    // dense3: { ...defaultUnitConfig, disabled: true },
  }) as Record<string, number>

  const setStatusText = useStatusText((s) => s.setStatusText)

  const model = useMemo(() => {
    if (!ds) return
    const [totalSamples, ...dims] = ds.data.trainX.shape
    const inputShape = [null, ...dims]

    const hiddenLayerConfig = Object.keys(modelConfig)
      .map((key) => ({
        name: key,
        size: modelConfig[key],
      }))
      .filter((l) => l.size)

    const _model = createModel(inputShape, hiddenLayerConfig, ds.output)
    console.log({ _model })
    const layersStr = _model.layers
      .map((l) => {
        const name = l.constructor.name
        const shape = l.outputShape.slice(1).join("x")
        return `${name} (${shape})`
      })
      .join(" | ")
    const totalParamas = _model.countParams()
    const text = `New Model: Sequential (${totalParamas.toLocaleString(
      "en-US"
    )} params)<br/>
${layersStr}<br/>
Dataset: ${ds.name} (${totalSamples.toLocaleString("en-US")} samples)<br/>`
    setStatusText(text)
    return _model
  }, [modelConfig, setStatusText, ds])

  return model
}

function createModel(
  inputShape: (number | null)[],
  layerConfig: { name: string; size: number }[],
  output: Dataset["output"]
) {
  const model = tf.sequential()
  model.add(tf.layers.inputLayer({ batchInputShape: inputShape }))
  for (const c of layerConfig) {
    const i = layerConfig.indexOf(c)
    if (c.name.startsWith("dense")) {
      if (i === 0) model.add(tf.layers.flatten())
      model.add(tf.layers.dense({ units: c.size, activation: "relu" }))
    } else if (c.name.startsWith("conv2d")) {
      model.add(
        tf.layers.conv2d({
          filters: c.size,
          kernelSize: 3, // 3x3 kernel
          activation: "relu",
        })
      )
      model.add(tf.layers.maxPooling2d({ poolSize: 2, strides: 2 }))
      model.add(tf.layers.flatten())
    }
  }
  if (!layerConfig.length) {
    model.add(tf.layers.flatten())
  }
  model.add(
    tf.layers.dense({ units: output.size, activation: output.activation })
  )
  return model
}
