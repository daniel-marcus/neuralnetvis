import { ControlPanel, useControlStores } from "@/components/controls"
import { Box, InlineButton } from "@/components/menu"
import { useStatusText } from "@/components/status"
import { useModelStore } from "@/lib/model"
import * as tf from "@tensorflow/tfjs"
import { StoreType } from "leva/dist/declarations/src/types"
import { useEffect, useState } from "react"

export const Model = () => {
  const modelConfigStore = useControlStores().modelConfigStore
  const model = useModelStore((s) => s.model)
  const setModel = useModelStore((s) => s.setModel)
  const setStatusText = useStatusText((s) => s.setStatusText)

  const [showModels, setShowModels] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const updateModelList = async () => {
    const allModels = await tf.io.listModels()
    const modelNames = Object.keys(allModels).map((k) =>
      k.replace(/^indexeddb:\/\//, "")
    )
    setModels(modelNames)
  }
  useEffect(() => {
    updateModelList()
  }, [])
  const loadModel = async (modelName: string) => {
    const newModel = await tf.loadLayersModel(`indexeddb://${modelName}`)
    updateModelConfig(newModel, modelConfigStore)
    setModel(newModel)
    setStatusText(`Model ${newModel.name} loaded from IndexedDB"`)
    setShowModels(false)
  }
  const [modelName, setModelName] = useState<string>(model?.name ?? "")
  useEffect(() => {
    console.log("MODEL CHANGED", model)
    setModelName(model?.name ?? "")
  }, [model])
  const saveModel = async () => {
    // TODO: also save dataset key?
    if (!model) return
    const saveName = modelName || model.name
    model.name = saveName
    const result = await model.save(`indexeddb://${saveName}`)
    updateModelList()
    console.log({ result })
    // await model.save(`downloads://${MODEL_NAME}`)
    setStatusText("Model saved to IndexedDB")
  }
  const removeModel = async (modelName: string) => {
    await tf.io.removeModel(`indexeddb://${modelName}`)
    updateModelList()
  }
  // TODO: download/import model from file
  // TODO: update modelConfig when model is loaded
  return (
    <Box>
      <div className="flex-col">
        {!!models.length && (
          <button className="p-4" onClick={() => setShowModels(!showModels)}>
            <Arrow
              className={`transition-transform ${
                showModels ? "rotate-0" : "-rotate-90"
              } duration-150`}
            />{" "}
            Saved Models
          </button>
        )}
        {!!models.length && showModels && (
          <ul className="p-4">
            {models.map((m, i) => (
              <li key={i} className="flex justify-between">
                <button onClick={() => loadModel(m)}>{m}</button>
                <button onClick={() => removeModel(m)}>x</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ControlPanel store={modelConfigStore} />
      <div className="p-4 flex justify-between gap-4">
        <input
          type="string"
          onChange={(e) => setModelName(e.target.value)}
          value={modelName}
        />
        <InlineButton onClick={saveModel} disabled={!model}>
          Save Model
        </InlineButton>
      </div>
    </Box>
  )
}

function updateModelConfig(
  newModel: tf.LayersModel | null,
  modelConfigStore: StoreType
) {
  // this is only a temporary solution until we have a model builder
  if (!newModel) return
  useModelStore.setState({ skipCreation: true })
  const newLayers = newModel.layers.slice(1, -1) // exclude input/output layers
  const currConfig = modelConfigStore.getData()
  console.log({ newLayers, modelConfigStore, currConfig })
  let denseCount = 0
  let convCount = 0
  for (const layer of newLayers) {
    const { units, filters } = layer.getConfig()
    const type = layer.getClassName()
    if (type === "Dense") {
      denseCount++
      if (units) {
        const path = `layers.dense${denseCount}`
        modelConfigStore.setValueAtPath(path, units as number, false)
        modelConfigStore.disableInputAtPath(path, false)
      }
    } else if (type === "Conv2D") {
      convCount++
      if (filters) {
        const path = `layers.conv${convCount}`
        modelConfigStore.setValueAtPath(path, filters as number, false)
        modelConfigStore.disableInputAtPath(path, false)
      }
    }
  }
  for (let i = denseCount + 1; i <= 2; i++) {
    modelConfigStore.disableInputAtPath(`layers.dense${i}`, true)
  }
  for (let i = convCount + 1; i <= 2; i++) {
    modelConfigStore.disableInputAtPath(`layers.conv${i}`, true)
  }
}

const Arrow = ({ className }: { className?: string }) => (
  <svg
    width="9"
    height="5"
    viewBox="0 0 9 5"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline ${className}`}
  >
    <path
      d="M3.8 4.4c.4.3 1 .3 1.4 0L8 1.7A1 1 0 007.4 0H1.6a1 1 0 00-.7 1.7l3 2.7z"
      fill="currentColor"
    ></path>
  </svg>
)
