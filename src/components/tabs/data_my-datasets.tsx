import { DB_PREFIX } from "@/data/db"
import { clearStatus, setStatus, useCurrScene } from "@/store"
import { deleteDB } from "idb"
import { useEffect, useState } from "react"
import { CollapsibleWithTitle } from "../ui-elements"
import { datasets } from "@/data/datasets"
import { getDsPath, resetData, getDsMetaFromDb } from "@/data/dataset"
import { useRouter } from "next/navigation"
import { DatasetMeta } from "@/data"

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
      console.error("Error listing databases:", error)
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
      router.push(getDsPath(dsDef))
    }
  }
  return (
    <CollapsibleWithTitle
      title="my datasets"
      border={false}
      variant="no-bg"
      collapsed
    >
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
                className={isCurrent ? "disabled pointer-events-none" : ""}
                onClick={() => handleSelect(d.key)}
              >
                {d.name} {d.loaded === "preview" ? "(preview)" : ""}
              </button>
              <div>
                {isCurrent && ds.isUserGenerated && !!totalSamples && (
                  <button
                    className="px-2"
                    onClick={() => {
                      resetData(ds.key, "train")
                      resetData(ds.key, "test")
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
