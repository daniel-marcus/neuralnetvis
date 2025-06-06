import Link from "next/link"
import type { MouseEventHandler, ReactNode } from "react"

interface ButtonProps {
  href?: string
  children: React.ReactNode
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>
  disabled?: boolean
  type?: "submit"
  variant?: "primary" | "secondary" | "transparent"
  className?: string
}

export const Button = ({
  href,
  children,
  onClick,
  disabled,
  type,
  variant = "primary",
  className = "",
}: ButtonProps) => {
  const Comp = href ? Link : "button"
  return (
    <Comp
      href={href as string}
      className={`px-2 h-6.5 border-1 border-transparent ${
        variant === "primary"
          ? "bg-accent text-white disabled:brightness-50 active:bg-accent-hover"
          : variant === "secondary"
          ? "bg-secondary active:text-white"
          : "hover:text-white active:text-white"
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
    className="brightness-50 hover:text-accent active:text-accent hover:brightness-100 active:brightness-100"
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
