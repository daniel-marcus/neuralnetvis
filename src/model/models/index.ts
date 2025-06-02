export interface ModelDef {
  key: string
  path: string
  version: Date
  // dsKey?: string
}

export const models: ModelDef[] = [
  {
    key: "cifar-10",
    path: "/models/cifar-10/model.json",
    version: new Date("2025-06-02"),
  },
  {
    key: "cifar-100",
    path: "/models/cifar-100/model.json",
    version: new Date("2025-06-02"),
  },
  {
    key: "mnist",
    path: "/models/mnist/model.json",
    version: new Date("2025-06-02"),
  },
  {
    key: "fashon-mnist",
    path: "/models/fashion-mnist/model.json",
    version: new Date("2025-06-02"),
  },
  {
    key: "california-housing",
    path: "/models/california-housing/model.json",
    version: new Date("2025-06-02"),
  },
  {
    key: "auto-mpg",
    path: "/models/auto-mpg/model.json",
    version: new Date("2025-06-02"),
  },
  {
    key: "hand-pose",
    path: "/models/hand-pose/model.json",
    version: new Date("2025-06-02"),
  },
]
