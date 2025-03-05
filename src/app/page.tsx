import { TileGrid } from "@/components/tile-grid"
import { InitialStateSetter } from "@/utils/initial-state"

export default async function Page() {
  return (
    <>
      <InitialStateSetter />
      <TileGrid />
    </>
  )
}
