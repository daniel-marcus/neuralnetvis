import { InitialStateSetter } from "@/utils/initial-state"
import { datasets } from "@/data/datasets"

export default async function Page() {
  return (
    <>
      <InitialStateSetter />
    </>
  )
}

export async function generateStaticParams() {
  return datasets.map((d) => ({ slug: d.key }))
}
