import { handPose } from "./hand-pose"
import { mnist } from "./mnist"
import { fashionMnist } from "./fashion-mnist"
import { cifar10 } from "./cifar10"
import { californiaHousing } from "./california-housing"
import { autoMpg } from "./auto-mpg"
import type { DatasetDef } from "@/data/types"
import { berlinAirbnb } from "../../../public/_dev/berlin-airbnb"

export const datasets: DatasetDef[] = [
  berlinAirbnb,
  fashionMnist,
  handPose,
  mnist,
  californiaHousing,
  cifar10,
  autoMpg,
] as const
