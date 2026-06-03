import { useSceneStore } from "@/store"
import { VideoCaptureBtns } from "./video"
import { AddSampleBtn } from "@/data/my-sample"

export function CustomBtns() {
  const ds = useSceneStore((s) => s.ds)
  return (
    <>
      {!!ds?.camProps && <VideoCaptureBtns />}
      <AddSampleBtn />
    </>
  )
}
