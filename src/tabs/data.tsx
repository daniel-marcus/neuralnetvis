import { Box, MenuBtn, Slider } from "@/ui-components"
import { datasets, useDatasetStore } from "@/lib/datasets"
import { useDebugStore } from "@/lib/debug"

export const Data = () => {
  const currDatasetKey = useDatasetStore((s) => s.datasetKey)
  const setDatasetKey = useDatasetStore((s) => s.setDatasetKey)
  const isDebug = useDebugStore((s) => s.debug)
  return (
    <Box>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col">
          {datasets
            .filter((d) => isDebug || !d.disabled)
            .map((d) => (
              <MenuBtn
                key={d.name}
                isActive={currDatasetKey === d.name}
                onClick={() => setDatasetKey(d.name)}
              >
                <strong>{d.name}</strong> ({d.task})<br />
                {d.description}
              </MenuBtn>
            ))}
        </div>
      </div>
    </Box>
  )
}

export function SampleSlider() {
  const i = useDatasetStore((s) => s.i)
  const setI = useDatasetStore((s) => s.setI)
  const totalSamples = useDatasetStore((s) => s.totalSamples)
  return (
    <Slider value={i} onChange={(v) => setI(v)} min={1} max={totalSamples} />
  )
}
