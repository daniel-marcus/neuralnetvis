import { DatasetDef } from "@/data/dataset"
import { mnist } from "./mnist"
import { fashionMnist } from "./fashion-mnist"
import { cifar10 } from "./cifar10"
import { californiaHousing } from "./california-housing"

export const datasets: DatasetDef[] = [
  mnist,
  fashionMnist,
  cifar10,
  californiaHousing,
] as const
