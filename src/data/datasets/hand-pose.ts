import { DatasetDef } from "../types"

export const handPose: DatasetDef = {
  disabled: true,
  key: "hand_pose",
  name: "hand pose",
  task: "classification",
  description: "Webcam hand pose classification",
  version: new Date("2025-02-24"),
  aboutUrl:
    "https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker",
  loss: "categoricalCrossentropy",
  input: {
    labels: [
      "wrist",
      "thumb_cmc",
      "thumb_mcp",
      "thumb_ip",
      "thumb_tip",
      "index_finger_mcp",
      "index_finger_pip",
      "index_finger_dip",
      "index_finger_tip",
      "middle_finger_mcp",
      "middle_finger_pip",
      "middle_finger_dip",
      "middle_finger_tip",
      "ring_finger_mcp",
      "ring_finger_pip",
      "ring_finger_dip",
      "ring_finger_tip",
      "pinky_mcp",
      "pinky_pip",
      "pinky_dip",
      "pinky_tip",
    ],
  },
  output: {
    activation: "softmax",
    size: 3,
    labels: ["rock", "paper", "scissors"],
  },
  loadData: async () => {
    const emptyData = [] as unknown as Float32Array
    return {
      xTrain: { data: emptyData, shape: [0, 21, 3] },
      yTrain: { data: emptyData, shape: [0, 21, 3] },
      xTest: { data: emptyData, shape: [0, 21, 3] },
      yTest: { data: emptyData, shape: [0, 21, 3] },
    }
  },
  storeBatchSize: 1,
}
