interface Props {
  size?: number
  className?: string
}

/**
 * World ID "Verified Human" badge icon - blue circle with white human silhouette.
 * Replaces the plain ✓ checkmark to signal World ID verification.
 */
export function WorldHumanIcon({ size = 12, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-label="Verified human"
      className={className}
    >
      {/* Blue background circle */}
      <circle cx="10" cy="10" r="10" fill="#1D5AFF" />
      {/* Head */}
      <circle cx="10" cy="7.5" r="2.6" fill="white" />
      {/* Shoulders / body arc */}
      <path
        d="M3.5 17.5C3.5 13.91 6.46 11 10 11s6.5 2.91 6.5 6.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
