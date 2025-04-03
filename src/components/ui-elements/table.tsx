import type { ReactNode } from "react"

export type TableProps = {
  data: Record<string, ReactNode>
  title?: ReactNode
  keyAlign?: "left" | "right"
  valueAlign?: "left" | "right"
  className?: string
}

export const Table = ({
  data,
  title,
  keyAlign = "left",
  valueAlign = "right",
  className = "",
}: TableProps) => (
  <table className={`table-auto w-full ${className}`}>
    {!!title && <caption className="whitespace-nowrap">{title}</caption>}
    <tbody>
      {Object.entries(data)
        .filter(([, value]) => typeof value !== "undefined")
        .map(([key, value]) => (
          <tr key={key}>
            <td
              className={`text-${keyAlign} align-top ${
                typeof value === "undefined" ? "opacity-50" : ""
              } pr-4`}
            >
              {key}
            </td>
            <td className={`align-top text-${valueAlign} break-words`}>
              {value}
            </td>
          </tr>
        ))}
    </tbody>
  </table>
)
