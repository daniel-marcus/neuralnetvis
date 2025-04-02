import { handPose } from "./hand-pose"
import { mnist } from "./mnist"
import { fashionMnist } from "./fashion-mnist"
import { cifar10 } from "./cifar10"
import { californiaHousing } from "./california-housing"
import { autoMpg } from "./auto-mpg"
import type { DatasetDef } from "@/data/types"

export const datasets: DatasetDef[] = [
  fashionMnist,
  handPose,
  mnist,
  californiaHousing,
  cifar10,
  autoMpg,
] as const
