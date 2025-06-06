import { handPose } from "./hand-pose"
import { mnist } from "./mnist"
import { fashionMnist } from "./fashion-mnist"
import { cifar10 } from "./cifar10"
import { cifar100 } from "./cifar100"
import { californiaHousing } from "./california-housing"
import { autoMpg } from "./auto-mpg"
import { mobileNetV2_96, mobileNetV2_224 } from "./mobilenet-v2"
import type { DatasetDef } from "@/data/types"

export const datasets: DatasetDef[] = [
  fashionMnist,
  mobileNetV2_96,
  mobileNetV2_224,
  handPose,
  californiaHousing,
  cifar10,
  mnist,
  cifar100,
  autoMpg,
] as const
