import { handPose } from "./hand-pose"
import { mnist } from "./mnist"
import { fashionMnist } from "./fashion-mnist"
import { cifar10 } from "./cifar10"
import { californiaHousing } from "./california-housing"
import type { DatasetDef } from "@/data/types"

export const datasets: DatasetDef[] = [
  handPose,
  mnist,
  fashionMnist,
  cifar10,
  californiaHousing,
] as const
