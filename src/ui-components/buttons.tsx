import Link from "next/link"

interface MenuBtnProps {
  href?: string
  children: React.ReactNode
  isActive?: boolean
  onClick?: () => void
}

// TODO: rename
export const MenuBtn = ({
  href,
  children,
  isActive,
  onClick,
}: MenuBtnProps) => {
  const Component = href ? Link : "button"
  return (
    <Component
      href={href as string}
      className={`p-4 ${
        isActive ? "bg-amber-200 text-black" : ""
      } hover:bg-accent-hover hover:text-white text-left rounded-box flex justify-start items-start`}
      onClick={onClick}
    >
      <div className="pr-2">&gt; </div>
      <div>{children}</div>
    </Component>
  )
}

interface InlineButtonProps {
  href?: string
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: "submit"
  variant?: "primary" | "secondary"
}

export const InlineButton = ({
  href,
  children,
  onClick,
  disabled,
  type,
  variant = "primary",
}: InlineButtonProps) => {
  const Comp = href ? Link : "button"
  return (
    <Comp
      href={href as string}
      className={`px-2 h-[24px] ${
        variant === "primary" ? "bg-accent text-white" : "bg-secondary"
      } rounded-[3px]`}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </Comp>
  )
}
