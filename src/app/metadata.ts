import manifest from "./manifest.json"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: manifest.name,
  description: manifest.description,
  openGraph: {
    images: [{ url: "https://neuralnetvis.app/images/neuralnetvis-og.png" }],
  },
}

export const learnMetadata: Metadata = {
  title: `Learn | ${metadata.title}`,
  description:
    "Coming soon: Learn some basic concepts about neural networks and machine learning",
}

export const playMetadata: Metadata = {
  title: `Play | ${metadata.title}`,
  description:
    "Play with neural networks: Pick a dataset, then adjust, train, and evaluate your model",
}
