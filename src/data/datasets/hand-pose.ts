import { DatasetDef } from "../types"

export const handPose: DatasetDef = {
  disabled: true,
  key: "hand_pose",
  name: "hand pose",
  task: "classification",
  description: "Webcam hand pose classification",
  version: new Date("2025-02-25"),
  aboutUrl:
    "https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker",
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
    labels: ["👍", "👌", "🤘"],
  },
  loadData: async () => {
    const emptyX = new Float32Array()
    const emptyY = new Uint8Array()
    return {
      xTrain: { data: emptyX, shape: [0, 21, 3, 2] },
      yTrain: { data: emptyY, shape: [0, 21, 3, 2] },
      xTest: { data: emptyX, shape: [0, 21, 3, 2] },
      yTest: { data: emptyY, shape: [0, 21, 3, 2] },
    }
  },
  storeBatchSize: 50,
  isUserGenerated: true,
}
