import { setTab } from "@/store"
import { Box, MenuBtn } from "@/components/ui-elements"

export const Play = () => {
  return (
    <Box padding={false}>
      <p className="p-4">Welcome to the playground!</p>
      <div className="flex flex-col">
        <MenuBtn onClick={() => setTab("data")}>Choose dataset</MenuBtn>
        <MenuBtn onClick={() => setTab("model")}>Configure model </MenuBtn>
        <MenuBtn onClick={() => setTab("train")}>Train model</MenuBtn>
      </div>
    </Box>
  )
}
