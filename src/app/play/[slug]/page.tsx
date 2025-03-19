import { datasets } from "@/data/datasets"
import { metadata } from "@/app/layout"
import manifest from "@/app/manifest.json"
import type { Metadata } from "next"

type Params = Promise<{ slug: string }>

export async function generateMetadata(props: { params: Params }) {
  const { slug } = await props.params
  const dsDef = getDsDefFromKey(slug)!
  const { name, description } = dsDef
  return {
    ...metadata,
    title: `${name} | ${manifest.name}`,
    description,
  } as Metadata
}
export default async function Page() {
  return null
}

export async function generateStaticParams() {
  return datasets.map((d) => ({ slug: d.key }))
}

function getDsDefFromKey(key: string) {
  return datasets.find((d) => d.key === key)
}
