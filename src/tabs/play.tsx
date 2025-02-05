import { useTabStore } from "@/components/menu"
import { Box, MenuBtn } from "@/ui-components"

export const Play = () => {
  const setTabByKey = useTabStore((s) => s.setTabByKey)
  return (
    <Box padding={false}>
      <p className="p-4">Welcome to the playground!</p>
      <div className="flex flex-col">
        <MenuBtn onClick={() => setTabByKey("data")}>Choose dataset</MenuBtn>
        <MenuBtn onClick={() => setTabByKey("model")}>Configure model </MenuBtn>
        <MenuBtn onClick={() => setTabByKey("train")}>Train model</MenuBtn>
      </div>
    </Box>
  )
}
