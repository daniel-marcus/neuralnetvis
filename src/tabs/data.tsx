import { ControlPanel, useControlStores } from "@/components/controls"
import { Box, MenuBtn } from "@/components/menu"
import { datasets } from "@/lib/datasets"
import { useRouter } from "next/navigation"

export const Data = () => {
  const dataStore = useControlStores().dataStore
  const currDatasetKey = dataStore.get("datasetKey")
  const router = useRouter()
  const handleClick = (key: string) => {
    dataStore.setValueAtPath("datasetKey", key, false)
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
      <ControlPanel store={dataStore} />
    </Box>
  )
}
