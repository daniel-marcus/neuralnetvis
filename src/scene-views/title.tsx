import { AsciiText, ExtLink } from "@/components/ui-elements"
import type { Dataset, DatasetDef } from "@/data/types"
import { useSceneStore } from "@/store"
import Link from "next/link"
import { useState } from "react"

interface SceneTitleProps {
  title: string
  href: string
  section?: string
  isActive?: boolean
  ds?: Dataset | DatasetDef
}

export function SceneTitle({ section, ...props }: SceneTitleProps) {
  const isActive = useSceneStore((s) => s.isActive)
  const Comp = section === "learn" ? LessonTitle : DsTitle
  return <Comp {...props} isActive={isActive} />
}

function LessonTitle({ title, href, isActive }: SceneTitleProps) {
  return (
    <div
      className={`${
        isActive
          ? "translate-y-[calc(20vh+var(--logo-height)-var(--padding-main))] w-full lesson-width lg:px-4" // to match original lesson title position
          : "translate-y-[calc(var(--tile-height)-100%-2rem)]"
      } transition-translate duration-[var(--tile-duration)]`}
    >
      <Link href={href}>
        <AsciiText
          className={`${
            isActive
              ? "text-ascii-title"
              : "text-logo pointer-events-auto group-hover/tile:text-white active:text-white"
          } [transition-property:all,color] [transition-duration:var(--tile-duration),0s]`}
        >
          {title}
        </AsciiText>
      </Link>
    </div>
  )
}

function DsTitle({ title, href, ds }: SceneTitleProps) {
  const isActive = useSceneStore((s) => s.isActive)
  const [showDescription, setShowDescription] = useState(true)
  const toggleDescription = () => setShowDescription((s) => !s)
  const Comp = !isActive ? Link : "button"
  const onClick = isActive ? toggleDescription : undefined
  return (
    <>
      <Comp
        href={href}
        onClick={onClick}
        className={`pointer-events-auto ${
          isActive
            ? "hover:text-white active:text-white screenshot:scale-150"
            : "group-hover/tile:text-white active:text-white"
        } origin-top-left`}
      >
        <AsciiText className={"text-logo mb-[-2em]"}>{title}</AsciiText>
      </Comp>
      {isActive && showDescription && <DsDescription ds={ds} />}
    </>
  )
}

const DsDescription = ({ ds }: { ds?: Dataset | DatasetDef }) => {
  const view = useSceneStore((s) => s.view)
  if (!ds) return null
  return (
    <div
      className={`max-w-[300px] mb-2 pointer-events-auto ${
        view === "evaluation" ? "hidden" : ""
      } screenshot:hidden`}
    >
      <p>{ds.description}</p>
      <p>
        <ExtLink href={ds.aboutUrl}>See Details</ExtLink>
      </p>
    </div>
  )
}
