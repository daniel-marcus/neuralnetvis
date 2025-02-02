import { Box, MenuBtn } from "@/components/menu"
import { Slider } from "@/components/slider"
import { datasets, useDatasetStore } from "@/lib/datasets"

export const Data = () => {
  const currDatasetKey = useDatasetStore((s) => s.datasetKey)
  const setDatasetKey = useDatasetStore((s) => s.setDatasetKey)
  const i = useDatasetStore((s) => s.i)
  const totalSamples = useDatasetStore((s) => s.totalSamples)
  return (
    <Box>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col">
          {datasets.map((d) => (
            <MenuBtn
              key={d.name}
              isActive={currDatasetKey === d.name}
              onClick={() => setDatasetKey(d.name)}
            >
              <strong>{d.name}</strong>
              {!!d.description && (
                <>
                  <br />
                  {d.description}
                </>
              )}
            </MenuBtn>
          ))}
        </div>
        <div className={"bg-box-bg p-4 rounded-[10px]"}>
          current sample: {i} / {totalSamples}
          <SampleSlider />
        </div>
      </div>
    </Box>
  )
}

function SampleSlider() {
  const i = useDatasetStore((s) => s.i)
  const setI = useDatasetStore((s) => s.setI)
  const totalSamples = useDatasetStore((s) => s.totalSamples)
  return (
    <Slider value={i} onChange={(v) => setI(v)} min={1} max={totalSamples} />
  )
}
