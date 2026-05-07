import { cn } from "@/lib/utils"

/**
 * Named size variants — all values are ~15% larger than previous defaults.
 * Use these rather than passing raw Tailwind size strings.
 *
 * sm  → sidebar header (collapsed-safe)
 * md  → marketing nav, auth header
 * lg  → hero / large placements
 */
const sizeMap = {
  sm: "text-xl",   // 20px  (+11% — sidebar header)
  md: "text-3xl",  // 30px  (+25% — marketing nav, auth header)
  lg: "text-4xl",  // 36px  (+20% — hero / large placements)
  xl: "text-5xl",  // 48px  (+33% — max size)
} as const

type LogoSize = keyof typeof sizeMap

interface LogoProps {
  className?: string
  size?: LogoSize
}

/**
 * upto. wordmark
 * - DM Sans Bold (700)
 * - Letter spacing: −104 design units = −0.104em
 * - "up" + "." → #222222
 * - "to"       → #e65336
 */
export function Logo({ className, size = "md" }: LogoProps) {
  return (
    <span
      className={cn(
        "font-logo font-bold leading-none select-none",
        sizeMap[size],
        className,
      )}
      style={{ letterSpacing: "-0.104em" }}
      aria-label="upto."
    >
      <span style={{ color: "#222222" }}>up</span>
      <span style={{ color: "#e65336" }}>to</span>
      <span style={{ color: "#222222" }}>.</span>
    </span>
  )
}
