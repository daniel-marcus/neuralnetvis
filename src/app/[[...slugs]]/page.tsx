import { DefaultInitialStateSetter } from "@/lib/initial-state"
import { TabSetter } from "@/components/menu"

type Params = Promise<{ slugs: string[] | undefined }>

export default async function Page(props: { params: Params }) {
  const { slugs } = await props.params
  return (
    <>
      <TabSetter slugs={slugs} />
      <DefaultInitialStateSetter />
    </>
  )
}

export async function generateStaticParams() {
  return [{ slugs: [] }, { slugs: ["learn"] }, { slugs: ["play"] }]
}
