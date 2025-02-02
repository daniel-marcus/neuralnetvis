import { Box, MenuBtn } from "@/components/menu"
import { datasets, useDatasetStore } from "@/lib/datasets"
import { useRouter } from "next/navigation"

export const Data = () => {
  const currDatasetKey = useDatasetStore((s) => s.datasetKey)
  const setDatasetKey = useDatasetStore((s) => s.setDatasetKey)
  const router = useRouter()
  const handleClick = (key: string) => {
    setDatasetKey(key)
    router.push("/play/model")
  }
  return (
    <Box>
      <div className="flex flex-col">
        {datasets.map((d) => (
          <MenuBtn
            key={d.name}
            isActive={currDatasetKey === d.name}
            onClick={() => handleClick(d.name)}
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
      {/* TODO: add slider */}
    </Box>
  )
}
