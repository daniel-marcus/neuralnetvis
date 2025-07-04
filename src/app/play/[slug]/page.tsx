import { datasets } from "@/data/datasets"
import { getOgImgUrl, metadata } from "@/app/metadata"
import type { Metadata } from "next"

type Params = Promise<{ slug: string }>

export async function generateMetadata(props: { params: Params }) {
  const { slug } = await props.params
  const dsDef = getDsDefFromKey(slug)!
  const { name, description } = dsDef
  return {
    title: `${name} | ${metadata.title}`,
    description,
    openGraph: {
      images: [{ url: getOgImgUrl(`play/${slug}`) }],
    },
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
