import { InitialStateSetter } from "@/utils/initial-state"
import { TabSetter } from "@/components/menu"

type Params = Promise<{ slugs: string[] | undefined }>

export default async function Page(props: { params: Params }) {
  const { slugs } = await props.params
  return (
    <>
      <TabSetter slugs={slugs} />
      <InitialStateSetter />
    </>
  )
}

export async function generateStaticParams() {
  return [{ slugs: [] }, { slugs: ["learn"] }, { slugs: ["play"] }]
}
