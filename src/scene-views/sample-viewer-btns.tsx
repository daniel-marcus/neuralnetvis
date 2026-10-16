import { useSceneStore } from "@/store"
import { VideoCaptureBtns } from "./video"
import { AddSampleBtn } from "@/data/my-sample"
import { CustomBtn } from "./custom-btn"
import { resetData } from "@/data/dataset"
import { isLoraDs } from "@/model/lora/training"

export function CustomBtns() {
  const ds = useSceneStore((s) => s.ds)
  return (
    <>
      {!!ds?.camProps && <VideoCaptureBtns />}
      <AddSampleBtn />
      {isLoraDs(ds) && <ClearSamplesBtn />}
    </>
  )
}

// LoRA: the texts saved as training samples (as for recorded hand poses, see HandPoseCapture)
function ClearSamplesBtn() {
  const ds = useSceneStore((s) => s.ds)
  const isTraining = useSceneStore((s) => s.isTraining)
  if (!ds?.train.totalSamples || isTraining) return null
  return (
    <CustomBtn
      onClick={async () => {
        const confirm = window.confirm("Are you sure you want to clear all saved samples?")
        if (confirm) await resetData(ds.key, "train")
      }}
    >
      x
    </CustomBtn>
  )
}
