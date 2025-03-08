import { useGlobalStore } from "@/store"
import { CollapsibleWithTitle } from "../ui-elements"
import { datasets } from "@/data/datasets"
import { setDsFromKey } from "@/data/dataset"
import { usePathname } from "next/navigation"
import Link from "next/link"

export const DatasetLibrary = () => {
  const pathname = usePathname()
  const isDebug = useGlobalStore((s) => s.isDebug)
  return (
    <CollapsibleWithTitle
      title="dataset library"
      variant="no-bg"
      border={false}
    >
      <div className="flex flex-col">
        {datasets
          .filter((d) => isDebug || !d.disabled)
          .map((d) => (
            <Link
              key={d.key}
              href={`/${d.key}`}
              className={`text-left py-2 has-menu-border hover:bg-menu-border ${
                pathname === `/${d.key}` ? "text-white border-accent!" : ""
              }`}
              onClick={() => setDsFromKey(d.key)}
            >
              <strong>{d.name}</strong> ({d.task})<br />
              {d.description}
            </Link>
          ))}
      </div>
    </CollapsibleWithTitle>
  )
}
