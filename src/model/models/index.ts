export interface ModelDef {
  key: string
  path: string
  version: Date
  sourceUrl?: string
  lazyLoadWeights?: boolean
  // dsKey?: string
}

const models = {
  "cifar-10": {
    key: "cifar-10",
    path: "/models/cifar-10/model.json",
    version: new Date("2025-06-02"),
  },
  "cifar-100": {
    key: "cifar-100",
    path: "/models/cifar-100/model.json",
    version: new Date("2025-06-02"),
  },
  mnist: {
    key: "mnist",
    path: "/models/mnist/model.json",
    version: new Date("2025-06-02"),
  },
  "fashion-mnist": {
    key: "fashon-mnist",
    path: "/models/fashion-mnist/model.json",
    version: new Date("2025-06-02"),
  },
  "california-housing": {
    key: "california-housing",
    path: "/models/california-housing/model.json",
    version: new Date("2025-06-02"),
  },
  "auto-mpg": {
    key: "auto-mpg",
    path: "/models/auto-mpg/model.json",
    version: new Date("2025-06-02"),
  },
  "hand-pose": {
    key: "hand-pose",
    path: "/models/hand-pose/model.json",
    version: new Date("2025-06-02"),
  },
  "mobilenet-v2": {
    key: "mobilenet-v2",
    path: "/models/mobilenet-v2/model.json",
    version: new Date("2025-06-04"),
    sourceUrl:
      "https://keras.io/api/applications/mobilenet/#mobilenetv2-function",
    lazyLoadWeights: true,
  },
} as const

export type ModelKey = keyof typeof models

export function getModelDef(modelKey: ModelKey): ModelDef | undefined {
  return models[modelKey]
}
