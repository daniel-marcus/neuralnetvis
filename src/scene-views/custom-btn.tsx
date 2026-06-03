interface CustomBtnProps {
  onClick: () => void
  children: React.ReactNode
  isActive?: boolean
  className?: string
}

export const CustomBtn = (props: CustomBtnProps) => (
  <button
    className={`flex-none border-2 w-(--item-size) rounded-md hover:border-marker ${
      props.isActive ? "border-accent" : ""
    } aspect-(--item-aspect-ratio) ${props.className ?? ""}`}
    onClick={props.onClick}
  >
    {props.children}
  </button>
)
