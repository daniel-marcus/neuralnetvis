import { DefaultInitialStateSetter } from "@/components/initial-state"
import { TabSetter } from "@/components/menu"

export default async function Page(props: {
  params: Promise<{ slugs: string[] | undefined }>
}) {
  const { slugs } = await props.params
  return (
    <>
      <TabSetter slugs={slugs} />
      <DefaultInitialStateSetter />
    </>
  )
}

export async function generateStaticParams() {
  return [{ slugs: [] }]
}
