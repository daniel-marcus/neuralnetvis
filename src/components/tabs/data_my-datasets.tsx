import * as tf from "@tensorflow/tfjs"
import { deleteDB } from "idb"
import { DB_PREFIX, getAll } from "@/data/db"
import { clearStatus, setStatus, useCurrScene } from "@/store"
import { useEffect, useState } from "react"
import { CollapsibleWithTitle } from "../ui-elements"
import { datasets } from "@/data/datasets"
import { getDsPath, resetData, getDsMetaFromDb } from "@/data/dataset"
import { useRouter } from "next/navigation"
import { DatasetMeta, DbBatch } from "@/data"

export const MyDatasets = () => {
  const ds = useCurrScene((s) => s.ds)
  const totalSamples = useCurrScene((s) => s.totalSamples())
  const [savedDatasets, setSavedDatasets] = useState<DatasetMeta[]>([])
  const updateDatasets = async () => {
    try {
      const databases = await indexedDB.databases()
      const dsNames = databases
        .filter((d) => d.name?.startsWith(DB_PREFIX))
        .map((d) => d.name?.replace(DB_PREFIX, ""))
        .filter(Boolean) as string[]
      const dsMetas: DatasetMeta[] = []
      for (const dsName of dsNames) {
        const dsMeta = await getDsMetaFromDb(dsName)
        if (dsMeta) dsMetas.push(dsMeta)
      }
      setSavedDatasets(dsMetas)
    } catch (error) {
      console.warn("Error listing databases:", error)
    }
  }
  useEffect(() => {
    updateDatasets()
  }, [ds])
  const router = useRouter()
  const removeDataset = async (dsKey: string) => {
    const fullName = `${DB_PREFIX}${dsKey}`
    const statusId = setStatus(`Removing dataset ${dsKey} ...`, -1)
    if (dsKey === ds?.key) {
      router.push("/")
    }
    await deleteDB(fullName)
    clearStatus(statusId)
    updateDatasets()
  }
  const handleSelect = async (dsKey: string) => {
    const dsDef =
      datasets.find((d) => d.key === dsKey) || (await getDsMetaFromDb(dsKey))
    if (dsDef) {
      const path = getDsPath(dsDef)
      router.push(path)
    }
  }
  return (
    <CollapsibleWithTitle title="my datasets" border={false} collapsed>
      <ul>
        {savedDatasets.map((d, i) => {
          const isCurrent = d.key === ds?.key
          return (
            <li
              key={i}
              className={`flex has-menu-border justify-between ${
                isCurrent ? "text-white border-accent!" : ""
              }`}
            >
              <button
                className={`flex-1 min-w-0 text-left truncate active:text-white ${
                  isCurrent ? "disabled pointer-events-none" : ""
                }`}
                onClick={() => handleSelect(d.key)}
              >
                {d.name} {d.loaded === "preview" ? "(preview)" : ""}
              </button>
              <div>
                {d.isUserGenerated && (
                  <button
                    className="px-2 active:text-white"
                    onClick={() => exportDs(d)}
                  >
                    export
                  </button>
                )}
                {isCurrent && d.isUserGenerated && !!totalSamples && (
                  <button
                    className="px-2"
                    onClick={() => {
                      resetData(d.key, "train")
                      resetData(d.key, "test")
                    }}
                  >
                    reset
                  </button>
                )}
                <button className="pl-2" onClick={() => removeDataset(d.key)}>
                  x
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </CollapsibleWithTitle>
  )
}

function saveArrayAsJson(array: unknown[], filename: string) {
  const blob = new Blob([JSON.stringify(array)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function exportDs(ds: DatasetMeta) {
  const batches = await getAll<DbBatch>(ds.key, "train")
  if (!batches.length) return
  const [X, y] = tf.tidy(() => {
    const xBatchTensors = batches.map((b) => tf.tensor(b.xsRaw ?? b.xs))
    const shapeX = [-1, ...ds.inputDims]
    const X = tf.concat(xBatchTensors).reshape(shapeX).arraySync() as number[][]
    const y = batches.flatMap((b) => Array.from(b.ys))
    return [X, y] as const
  })
  saveArrayAsJson(X, `x_train.json`)
  saveArrayAsJson(y, `y_train.json`)
}
