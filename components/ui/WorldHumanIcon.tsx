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
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Verified human"
      className={className}
    >
      {/* Official World "Unique Human" badge */}
      <circle cx="12" cy="12" r="10" fill="#005CFF" />
      {/* Body + arms */}
      <path
        d="M17.3711 10.9277L13 12.6758V17.999H11V12.6758L6.62891 10.9277L7.37109 9.07031L12 10.9219L16.6289 9.07031L17.3711 10.9277Z"
        fill="white"
      />
      {/* Head */}
      <path
        d="M12.0389 9.31641C12.7293 9.31641 13.2891 8.75676 13.2891 8.0664C13.2891 7.37605 12.7293 6.81641 12.0389 6.81641C11.3484 6.81641 10.7887 7.37605 10.7887 8.0664C10.7887 8.75676 11.3484 9.31641 12.0389 9.31641Z"
        fill="white"
      />
    </svg>
  )
}
