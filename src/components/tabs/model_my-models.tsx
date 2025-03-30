import { useCallback, useEffect, useState } from "react"
import * as tf from "@tensorflow/tfjs"
import {
  CollapsibleWithTitle,
  InlineButton,
  InputRowsWrapper,
  TextInput,
} from "@/components/ui-elements"
import { clearStatus, setStatus, useCurrScene, useGlobalStore } from "@/store"
import type { FormEvent } from "react"
import { useModelTransition } from "@/model/model"

export function MyModels() {
  const model = useCurrScene((s) => s.model)
  const [updTrigger, setUpdTrigger] = useState(0)
  const updateList = useCallback(() => setUpdTrigger((t) => t + 1), [])
  const [showImportForm, setShowImportForm] = useState(false)
  const setStatus = useGlobalStore((s) => s.status.update)
  const defaultName = useCurrScene((s) => `my_${s.ds?.key ?? ""}_model`)
  const [modelName, setModelName] = useState<string>(defaultName)
  useEffect(() => {
    setModelName(defaultName)
  }, [defaultName])
  const saveModel = async () => {
    // TODO: also save dataset key?
    if (!model) return
    model.name = modelName
    await model.save(`indexeddb://${modelName}`)
    setStatus("Model saved to IndexedDB")
    updateList()
  }
  const onUploadFinished = useCallback(() => {
    updateList()
    setShowImportForm(false)
  }, [updateList])
  return (
    <CollapsibleWithTitle title="my models" border={false} collapsed>
      <InputRowsWrapper>
        <SavedModels updTrigger={updTrigger} />
        <div className="flex justify-between gap-2">
          <TextInput onChange={setModelName} value={modelName} />
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
        {showImportForm && <ImportForm onUploadFinished={onUploadFinished} />}
      </InputRowsWrapper>
    </CollapsibleWithTitle>
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

  const _setModel = useCurrScene((s) => s._setModel)
  const [setModel] = useModelTransition(_setModel)

  const loadModel = async (modelName: string) => {
    const newModel = await tf.loadLayersModel(`indexeddb://${modelName}`)
    setModel(newModel)
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
    <ul>
      {savedModels.map((m, i) => (
        <li key={i} className="flex justify-between has-menu-border">
          <button
            className="flex-1 min-w-0 text-left truncate"
            onClick={() => loadModel(m)}
          >
            {m}
          </button>
          <div className="flex gap-2 flex-nowrap">
            <button className="px-2" onClick={() => exportModel(m)}>
              export
            </button>
            <button onClick={() => removeModel(m)}>x</button>
          </div>
        </li>
      ))}
    </ul>
  )
}

interface ImportFormProps {
  onUploadFinished: () => void
}

const IMPORT_STATUS = "import_status"

function ImportForm({ onUploadFinished }: ImportFormProps) {
  const _setModel = useCurrScene((s) => s._setModel)
  const onImportFinished = useCallback(() => {
    clearStatus(IMPORT_STATUS)
    onUploadFinished()
  }, [onUploadFinished])
  const [setModel] = useModelTransition(_setModel, onImportFinished)
  const [modelFiles, setModelFiles] = useState<FileList | null>(null)
  const importModel = useCallback(
    async (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault()
      if (!modelFiles) return
      setStatus("Importing model ...", -1, { id: IMPORT_STATUS })
      const newModel = await tf.loadLayersModel(
        tf.io.browserFiles([...modelFiles])
      )
      await newModel.save(`indexeddb://imported_${newModel.name}`)
      setModel(newModel)
    },
    [modelFiles, setModel]
  )
  useEffect(() => {
    if (!modelFiles) return
    importModel()
  }, [modelFiles, importModel])
  return (
    <form onSubmit={importModel}>
      <div className="pl-4 border-l border-menu-border flex flex-col gap-2">
        <label className="block cursor-pointer input-appearance">
          {modelFiles
            ? modelFiles.length + " model file(s) selected"
            : "Choose model.json & weights.bin"}
          <input
            type="file"
            multiple
            id="model-files"
            className="hidden text-transparent"
            placeholder="Choose files"
            onChange={(e) => setModelFiles(e.target.files ?? null)}
          />
        </label>
      </div>
    </form>
  )
}
