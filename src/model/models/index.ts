export interface ModelDef {
  key: string
  path: string
  version: Date
  sourceUrl?: string
  lazyLoadWeights?: boolean
  // dsKey?: string
}

const defineModels = <T extends Record<string, ModelDef>>(models: T) => models
const models = defineModels({
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
    key: "fashion-mnist",
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
  "mobilenet-v2-96": {
    key: "mobilenet-v2-96",
    path: "/models/mobilenet-v2/mobilenetv2_1.00_96.json",
    version: new Date("2025-06-06"),
    sourceUrl:
      "https://keras.io/api/applications/mobilenet/#mobilenetv2-function",
    lazyLoadWeights: true,
  },
  "mobilenet-v2-224": {
    key: "mobilenet-v2-224",
    path: "/models/mobilenet-v2/mobilenetv2_1.00_224.json",
    version: new Date("2025-06-06"),
    sourceUrl:
      "https://keras.io/api/applications/mobilenet/#mobilenetv2-function",
    lazyLoadWeights: true,
  },
})

export type ModelKey = keyof typeof models

export function getModelDef(modelKey: ModelKey): ModelDef | undefined {
  return models[modelKey]
}
