export interface ModelDef {
  key: string
  path: string
  version: string
  sourceUrl?: string
  lazyLoadWeights?: boolean
  // dsKey?: string
}

const defineModels = <T extends Record<string, ModelDef>>(models: T) => models
const models = defineModels({
  "cifar-10": {
    key: "cifar-10",
    path: "/models/cifar-10/model.json",
    version: "1.0",
  },
  "cifar-100": {
    key: "cifar-100",
    path: "/models/cifar-100/model.json",
    version: "1.0",
  },
  mnist: {
    key: "mnist",
    path: "/models/mnist-conv/model.json",
    version: "1.0",
  },
  "fashion-mnist": {
    key: "fashion-mnist",
    path: "/models/fashion-mnist/model.json",
    version: "1.0",
  },
  "california-housing": {
    key: "california-housing",
    path: "/models/california-housing/model.json",
    version: "1.0",
  },
  "auto-mpg": {
    key: "auto-mpg",
    path: "/models/auto-mpg/model.json",
    version: "1.0",
  },
  "hand-pose": {
    key: "hand-pose",
    path: "/models/hand-pose/model.json",
    version: "1.0",
  },
  "mobilenet-v2-96": {
    key: "mobilenet-v2-96",
    path: "/models/mobilenet-v2/mobilenetv2_1.00_96.json",
    version: "1.0",
    sourceUrl:
      "https://keras.io/api/applications/mobilenet/#mobilenetv2-function",
    lazyLoadWeights: true,
  },
  /* "mobilenet-v2-128": {
    key: "mobilenet-v2-128",
    path: "/models/mobilenet-v2/mobilenetv2_1.00_128.json",
    version: "1.0",
    sourceUrl:
      "https://keras.io/api/applications/mobilenet/#mobilenetv2-function",
    lazyLoadWeights: true,
  }, */
  "mobilenet-v2-224": {
    key: "mobilenet-v2-224",
    path: "/models/mobilenet-v2/mobilenetv2_1.00_224.json",
    version: "1.0",
    sourceUrl:
      "https://keras.io/api/applications/mobilenet/#mobilenetv2-function",
    lazyLoadWeights: true,
  },
  imdb: {
    key: "imdb",
    path: "/models/imdb/model.json",
    version: "1.0",
  },
})

export type ModelKey = keyof typeof models

export function getModelDef(modelKey: ModelKey): ModelDef | undefined {
  return models[modelKey]
}
