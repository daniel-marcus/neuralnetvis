import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"
import type { DatasetDef } from "@/data/types"

export const bloodMnist: DatasetDef = {
  key: "blood-mnist",
  name: "Blood MNIST",
  task: "classification",
  description: "Blood cell microscope images (224x224x3)",
  version: new Date("2025-04-17"),
  aboutUrl: "https://medmnist.com",
  inputDims: [224, 224, 3],
  preprocessFunc: "normalizeImage",
  outputLabels: [
    "basophil",
    "eosinophil",
    "erythroblast",
    "immature granulocytes", // (myelocytes, metamyelocytes and promyelocytes)",
    "lymphocyte",
    "monocyte",
    "neutrophil",
    "platelet",
  ],
  loadPreview: async () => {
    const [xTrain, yTrain] = await fetchMutlipleNpzWithProgress(
      [
        "/_dev/data/blood-mnist/x_train_preview.npz",
        "/_dev/data/blood-mnist/y_train_preview.npz",
      ],
      true
    )
    // add depth dim for Conv2D layers
    xTrain.shape = [...xTrain.shape, 1]
    return { xTrain, yTrain }
  },
}
