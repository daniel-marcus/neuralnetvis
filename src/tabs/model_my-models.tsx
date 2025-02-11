import { useStatusText } from "@/components/status"
import { useModelStore, useModelTransition } from "@/tf/model"
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react"
import * as tf from "@tensorflow/tfjs"
import { ControlPanel, InlineButton } from "@/ui-components"

export function MyModels() {
  const model = useModelStore((s) => s.model)
  const [updTrigger, setUpdTrigger] = useState(0)
  const updateList = () => setUpdTrigger((t) => t + 1)
  const [showImportForm, setShowImportForm] = useState(false)
  const setStatusText = useStatusText((s) => s.setStatusText)
  const [modelName, setModelName] = useState<string>(model?.name ?? "")
  useEffect(() => {
    setModelName(model?.name ?? "")
  }, [model])
  const saveModel = async () => {
    // TODO: also save dataset key?
    if (!model) return
    model.name = modelName
    await model.save(`indexeddb://${modelName}`)
    setStatusText("Model saved to IndexedDB")
    updateList()
  }
  return (
    <ControlPanel title="my models" variant="no-bg" collapsed>
      <SavedModels updTrigger={updTrigger} />
      <div className="flex justify-between gap-2">
        <input
          type="string"
          onChange={(e) => setModelName(e.target.value)}
          value={modelName}
        />
        <div className="flex gap-2">
          <InlineButton onClick={saveModel} disabled={!model}>
            save
          </InlineButton>
          <InlineButton
            variant="secondary"
            onClick={() => setShowImportForm((i) => !i)}
          >
            import
          </InlineButton>
        </div>
      </div>
      {showImportForm && (
        <ImportForm
          onUploadFinished={() => {
            setShowImportForm(false)
            updateList()
          }}
        />
      )}
    </ControlPanel>
  )
}

function SavedModels({ updTrigger }: { updTrigger: number }) {
  const [savedModels, setSavedModels] = useState<string[]>([])
  const updateModelList = async () => {
    const allModels = await tf.io.listModels()
    const modelNames = Object.keys(allModels).map((k) =>
      k.replace(/^indexeddb:\/\//, "")
    )
    setSavedModels(modelNames)
  }
  useEffect(() => {
    updateModelList()
  }, [updTrigger])

  const [setModel] = useModelTransition()
  const setStatusText = useStatusText((s) => s.setStatusText)
  const loadModel = async (modelName: string) => {
    const newModel = await tf.loadLayersModel(`indexeddb://${modelName}`)
    setModel(newModel)
    setStatusText(`Model ${newModel.name} loaded from IndexedDB"`)
  }
  const exportModel = async (modelKey: string) => {
    const exportModel = await tf.loadLayersModel(`indexeddb://${modelKey}`)
    await exportModel.save(`downloads://${modelKey}`)
  }
  const removeModel = async (modelName: string) => {
    await tf.io.removeModel(`indexeddb://${modelName}`)
    updateModelList()
  }
  if (!savedModels.length) return null
  return (
    <ul className="pl-4 border-l border-menu-border mb-4">
      {savedModels.map((m, i) => (
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
  )
}

interface ImportFormProps {
  onUploadFinished: () => void
}

function ImportForm({ onUploadFinished }: ImportFormProps) {
  const [setModel] = useModelTransition()
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [weightsFiles, setWeightsFiles] = useState<FileList | null>(null)
  const importModel = useCallback(
    async (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault()
      if (!modelFile || !weightsFiles) return
      const newModel = await tf.loadLayersModel(
        tf.io.browserFiles([modelFile, ...weightsFiles])
      )
      await newModel.save(`indexeddb://imported_${newModel.name}`)
      setModel(newModel)
      onUploadFinished()
    },
    [modelFile, weightsFiles, onUploadFinished, setModel]
  )
  const [isPending, startTransition] = useTransition()
  useEffect(() => {
    if (!modelFile || !weightsFiles) return
    startTransition(importModel)
  }, [modelFile, weightsFiles, importModel])
  return (
    <form onSubmit={importModel}>
      <div className="pl-4 border-l border-menu-border flex flex-col gap-2">
        <label className="block cursor-pointer">
          {modelFile ? modelFile.name : "Choose model.json ..."}
          <input
            type="file"
            id="model-file"
            className="hidden text-transparent"
            onChange={(e) => setModelFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="block cursor-pointer">
          {weightsFiles
            ? weightsFiles.length + " weight file(s) selected"
            : "Choose weights.bin ..."}
          <input
            type="file"
            multiple
            id="weights-file"
            className="hidden text-transparent"
            placeholder="Choose file"
            onChange={(e) => setWeightsFiles(e.target.files ?? null)}
          />
        </label>
      </div>
      {isPending && <div className="mt-2">Loading ...</div>}
    </form>
  )
}
