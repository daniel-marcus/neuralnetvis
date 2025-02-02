import { ControlPanel, useControlStores } from "@/components/controls"
import { Box } from "@/components/menu"

export const Train = () => {
  const trainConfigStore = useControlStores().trainConfigStore
  return (
    <Box>
      <ControlPanel store={trainConfigStore} />
    </Box>
  )
}
