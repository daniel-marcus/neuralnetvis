import manifest from "./manifest.json"
import type { Metadata } from "next"

const BASE_URL = "https://neuralnetvis.app"

export function getOgImgUrl(path: string) {
  return `${BASE_URL}/images/og/${pathToFileName(path)}.png`
}

function pathToFileName(path: string): string {
  return path.replace(/^\//, "").replace(/\//g, "_")
}

export const metadata: Metadata = {
  title: manifest.name,
  description: manifest.description,
  openGraph: {
    images: [{ url: getOgImgUrl("default") }],
  },
}

export const learnMetadata: Metadata = {
  title: `Learn | ${metadata.title}`,
  description:
    "Coming soon: Learn some basic concepts about neural networks and machine learning",
  openGraph: {
    images: [{ url: getOgImgUrl("learn") }],
  },
}

export const playMetadata: Metadata = {
  title: `Play | ${metadata.title}`,
  description:
    "Play with neural networks: Pick a dataset, then adjust, train, and evaluate your model",
  openGraph: {
    images: [{ url: getOgImgUrl("play") }],
  },
}
