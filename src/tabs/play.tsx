import { Box, MenuBtn } from "@/components/menu"

export const Play = () => (
  <Box padding={false}>
    <p className="p-4">Welcome to the playground!</p>
    <div className="flex flex-col">
      <MenuBtn href="/play/data">Choose dataset</MenuBtn>
      <MenuBtn href="/play/model">Configure model </MenuBtn>
      <MenuBtn href="/play/train">Train model</MenuBtn>
    </div>
  </Box>
)
