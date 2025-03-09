import { datasets } from "@/data/datasets"

export default async function Page() {
  return null
}

export async function generateStaticParams() {
  return datasets.map((d) => ({ slug: d.key }))
}
