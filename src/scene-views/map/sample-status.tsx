import { useEffect } from "react"
import { clearStatus, setStatus, useSceneStore } from "@/store"
import { Table } from "@/components/ui-elements"
import { round } from "@/data/utils"

export function useCurrSampleStatus(isActive?: boolean) {
  const sample = useSceneStore((s) => s.sample)
  const ds = useSceneStore((s) => s.ds)
  useEffect(() => {
    if (!isActive || !sample || !ds?.inputLabels) return
    const values = sample.rawX ?? sample.X
    const outputLabel = ds.outputLabels?.[0] ?? "y"
    const dataEntries = [
      ...ds.inputLabels.map((label, i) => [label, round(values[i])]),
      [outputLabel, round(sample.y)],
    ]
    const data = Object.fromEntries(dataEntries)
    const STATUS_ID = "sample-status"
    if (data)
      setStatus(<Table data={data} />, undefined, {
        id: STATUS_ID,
      })
    return () => clearStatus(STATUS_ID)
  }, [isActive, sample, ds])
}
