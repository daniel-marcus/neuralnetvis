import { handPose } from "./hand-pose"
import { mnist } from "./mnist"
import { fashionMnist } from "./fashion-mnist"
import { cifar10 } from "./cifar10"
import { californiaHousing } from "./california-housing"
import type { DatasetDef } from "@/data/types"
import { autoMpg } from "./auto-mpg"

export const datasets: DatasetDef[] = [
  handPose,
  fashionMnist,
  mnist,
  cifar10,
  autoMpg,
  californiaHousing,
] as const
