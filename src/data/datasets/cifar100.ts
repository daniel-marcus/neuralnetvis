import { fetchMutlipleNpzWithProgress } from "@/data/npy-loader"
import { getModelDef } from "@/model/models"
import type { DatasetDef } from "@/data/types"

export const cifar100: DatasetDef = {
  key: "cifar-100",
  name: "CIFAR-100",
  task: "classification",
  description: "Color images (32x32x3)",
  version: new Date("2025-03-19"),
  aboutUrl: "https://www.cs.toronto.edu/~kriz/cifar.html",
  inputDims: [32, 32, 3],
  preprocessFunc: "normalizeImage",
  outputLabels: [
    "apple",
    "aquarium_fish",
    "baby",
    "bear",
    "beaver",
    "bed",
    "bee",
    "beetle",
    "bicycle",
    "bottle",
    "bowl",
    "boy",
    "bridge",
    "bus",
    "butterfly",
    "camel",
    "can",
    "castle",
    "caterpillar",
    "cattle",
    "chair",
    "chimpanzee",
    "clock",
    "cloud",
    "cockroach",
    "couch",
    "crab",
    "crocodile",
    "cup",
    "dinosaur",
    "dolphin",
    "elephant",
    "flatfish",
    "forest",
    "fox",
    "girl",
    "hamster",
    "house",
    "kangaroo",
    "keyboard",
    "lamp",
    "lawn_mower",
    "leopard",
    "lion",
    "lizard",
    "lobster",
    "man",
    "maple_tree",
    "motorcycle",
    "mountain",
    "mouse",
    "mushroom",
    "oak_tree",
    "orange",
    "orchid",
    "otter",
    "palm_tree",
    "pear",
    "pickup_truck",
    "pine_tree",
    "plain",
    "plate",
    "poppy",
    "porcupine",
    "possum",
    "rabbit",
    "raccoon",
    "ray",
    "road",
    "rocket",
    "rose",
    "sea",
    "seal",
    "shark",
    "shrew",
    "skunk",
    "skyscraper",
    "snail",
    "snake",
    "spider",
    "squirrel",
    "streetcar",
    "sunflower",
    "sweet_pepper",
    "table",
    "tank",
    "telephone",
    "television",
    "tiger",
    "tractor",
    "train",
    "trout",
    "tulip",
    "turtle",
    "wardrobe",
    "whale",
    "willow_tree",
    "wolf",
    "woman",
    "worm",
  ],
  model: getModelDef("cifar-100"),
  loadFull: async () => {
    const [xTrain1, xTrain2, xTrain3, yTrain, xTest, yTest] =
      await fetchMutlipleNpzWithProgress([
        "/data/cifar100_18k/x_train_1.npz",
        "/data/cifar100_18k/x_train_2.npz",
        "/data/cifar100_18k/x_train_3.npz",
        "/data/cifar100_18k/y_train.npz",
        "/data/cifar100_18k/x_test.npz",
        "/data/cifar100_18k/y_test.npz",
      ])
    const [, ...dims] = xTrain1.shape
    const length = xTrain1.shape[0] + xTrain2.shape[0] + xTrain3.shape[0]
    const xTrainData = new Uint8Array(length * dims.reduce((a, b) => a * b, 1))

    // concat xTrain1, xTrain2, xTrain3
    let offset = 0
    for (const arr of [xTrain1.data, xTrain2.data, xTrain3.data]) {
      xTrainData.set(arr, offset)
      offset += arr.length
    }

    const xTrain = {
      shape: [length, ...dims],
      data: xTrainData,
      dtype: xTrain1.dtype,
      fortranOrder: xTrain1.fortranOrder,
    }
    return { xTrain, yTrain, xTest, yTest }
  },

  loadPreview: async () => {
    const [xTrain, yTrain] = await fetchMutlipleNpzWithProgress(
      [
        "/data/cifar100_18k/x_train_preview.npz",
        "/data/cifar100_18k/y_train_preview.npz",
      ],
      true
    )
    return { xTrain, yTrain }
  },
}
