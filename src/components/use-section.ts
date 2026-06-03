import { usePathname } from "next/navigation"

export function useSection() {
  // only for overview pages /learn and /play
  const pathname = usePathname()
  const splits = pathname.split("/")
  return splits.length === 2 ? splits[1] : ""
}
