import Link from "next/link"
import type { ReactNode } from "react"

interface MenuBtnProps {
  href?: string
  children: React.ReactNode
  isActive?: boolean
  onClick?: () => void
  className?: string
  variant?: "default" | "no-arrow"
}

// TODO: rename
export const MenuBtn = ({
  href,
  children,
  isActive,
  onClick,
  className = "",
  variant = "default",
}: MenuBtnProps) => {
  const Component = href ? Link : "button"
  return (
    <Component
      href={href as string}
      className={`p-4 ${
        isActive ? "text-white" : ""
      } hover:bg-accent-hover text-left rounded-box flex justify-start items-start ${className}`}
      onClick={onClick}
    >
      {variant !== "no-arrow" && <div className="pr-2">&gt; </div>}
      <div className="flex-1">{children}</div>
    </Component>
  )
}

interface InlineButtonProps {
  href?: string
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: "submit"
  variant?: "primary" | "secondary" | "transparent"
  className?: string
}

export const InlineButton = ({
  href,
  children,
  onClick,
  disabled,
  type,
  variant = "primary",
  className = "",
}: InlineButtonProps) => {
  const Comp = href ? Link : "button"
  return (
    <Comp
      href={href as string}
      className={`px-2 ${
        variant === "primary"
          ? "bg-accent text-white disabled:opacity-50"
          : variant === "secondary"
          ? "bg-secondary"
          : "hover:text-white"
      } rounded-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </Comp>
  )
}

type ExtLinkProps = { href: string; children: ReactNode }

export const ExtLink = ({ href, children }: ExtLinkProps) => (
  <a
    href={href}
    rel="noopener"
    className="text-secondary hover:text-accent"
    target="_blank"
  >
    {children}
  </a>
)

interface ArrowProps {
  direction?: "right" | "down" | "left" | "up"
  className?: string
}

export const Arrow = ({ className, direction: d = "right" }: ArrowProps) => (
  <svg
    width="9"
    height="5"
    viewBox="0 0 9 5"
    xmlns="http://www.w3.org/2000/svg"
    className={`inline transition-transform ${
      d === "right"
        ? "-rotate-90"
        : d === "up"
        ? "rotate-180"
        : d === "left"
        ? "rotate-90"
        : ""
    } duration-150 mr-2 ${className}`}
  >
    <path
      d="M3.8 4.4c.4.3 1 .3 1.4 0L8 1.7A1 1 0 007.4 0H1.6a1 1 0 00-.7 1.7l3 2.7z"
      fill="currentColor"
    ></path>
  </svg>
)
