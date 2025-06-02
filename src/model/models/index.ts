export interface ModelDef {
  key: string
  path: string
  version: Date
}

export const models: ModelDef[] = [
  {
    key: "cifar-100-test",
    path: "/_dev/models/cifar-100-test/model.json",
    version: new Date("2025-06-02"),
  },
]
