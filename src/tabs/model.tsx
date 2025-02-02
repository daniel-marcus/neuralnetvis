import { ControlPanel, useControlStores } from "@/components/controls"
import { Box, InlineButton } from "@/components/menu"
import { useStatusText } from "@/components/status"
import { useModelStore } from "@/lib/model"
import * as tf from "@tensorflow/tfjs"
import { StoreType } from "leva/dist/declarations/src/types"
import { FormEvent, useEffect, useState } from "react"

export const Model = () => {
  const modelConfigStore = useControlStores().modelConfigStore
  const model = useModelStore((s) => s.model)
  const setModel = useModelStore((s) => s.setModel)
  const setStatusText = useStatusText((s) => s.setStatusText)

  const [showModels, setShowModels] = useState(false)
  const [showImport, setShowImport] = useState(false)
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
    model.name = modelName
    const result = await model.save(`indexeddb://${modelName}`)
    updateModelList()
    console.log({ result })
    setStatusText("Model saved to IndexedDB")
  }
  const exportModel = async (modelKey: string) => {
    const exportModel = await tf.loadLayersModel(`indexeddb://${modelKey}`)
    await exportModel.save(`downloads://${modelKey}`)
  }
  const removeModel = async (modelName: string) => {
    await tf.io.removeModel(`indexeddb://${modelName}`)
    updateModelList()
  }

  // TODO: download/import model from file
  return (
    <Box>
      <div className="flex-col">
        <div
          className={`flex ${
            models.length ? "justify-between" : "justify-end"
          }`}
        >
          {!!models.length && (
            <button
              className="p-4"
              onClick={() => {
                setShowImport(false)
                setShowModels(!showModels)
              }}
            >
              <Arrow
                className={`transition-transform ${
                  showModels ? "rotate-0" : "-rotate-90"
                } duration-150`}
              />{" "}
              saved models
            </button>
          )}
          <button
            className="p-4"
            onClick={() => {
              setShowModels(false)
              setShowImport(!showImport)
            }}
          >
            import
          </button>
        </div>
        {!!models.length && showModels && (
          <ul className="p-4">
            {models.map((m, i) => (
              <li key={i} className="flex justify-between">
                <button onClick={() => loadModel(m)}>{m}</button>
                <div>
                  <button className="px-2" onClick={() => exportModel(m)}>
                    export
                  </button>
                  <button className="pl-2" onClick={() => removeModel(m)}>
                    x
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {showImport && (
          <Import
            modelConfigStore={modelConfigStore}
            onUploadFinished={() => {
              setShowImport(false)
              updateModelList()
            }}
          />
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
          save model
        </InlineButton>
      </div>
    </Box>
  )
}

interface ImportProps {
  onUploadFinished: () => void
  modelConfigStore: StoreType
}

function Import({ onUploadFinished, modelConfigStore }: ImportProps) {
  const setModel = useModelStore((s) => s.setModel)
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [weightsFile, setWeightsFile] = useState<File | null>(null)
  const importModel = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    if (!modelFile || !weightsFile) return
    const newModel = await tf.loadLayersModel(
      tf.io.browserFiles([modelFile, weightsFile])
    )
    newModel.save(`indexeddb://imported_${newModel.name}`)
    updateModelConfig(newModel, modelConfigStore)
    setModel(newModel)
    onUploadFinished()
  }
  return (
    <div className="p-4">
      <form onSubmit={importModel}>
        <label className="block">
          {modelFile ? modelFile.name : "Choose model.json ..."}
          <input
            type="file"
            id="model-file"
            className="file:hidden text-transparent"
            onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="block">
          {weightsFile ? weightsFile.name : "Choose weights.bin ..."}
          <input
            type="file"
            id="weights-file"
            className="file:hidden text-transparent"
            placeholder="Choose file"
            onChange={(e) => setWeightsFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="text-right">
          {!!modelFile && !!weightsFile && (
            <InlineButton type="submit">Import</InlineButton>
          )}
        </div>
      </form>
    </div>
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
