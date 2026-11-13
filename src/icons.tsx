import type { ReactNode } from 'react'

// Line icons drawn on a 24 x 24 grid. They take their colour from the text around them.
function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none"
    >
      {children}
    </svg>
  )
}

type Props = { size?: number }

export const SidebarIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
  </Icon>
)

export const PhotoIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <circle cx="12" cy="10" r="3" />
    <path d="M7.5 18c.8-2.2 2.5-3.3 4.5-3.3s3.7 1.1 4.5 3.3" />
  </Icon>
)

export const SignatureIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M3 17c2.5-6 4.5-9 6-9 2 0-1 8 1 8 1.5 0 2.5-4 4-4 1.2 0 .8 3 2 3 .900 0 1.7-.700 3-2" />
    <path d="M3 21h18" />
  </Icon>
)

export const SunIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)

export const MoonIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icon>
)

export const UploadIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" />
  </Icon>
)

export const DownloadIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14" />
  </Icon>
)

export const RotateIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" />
  </Icon>
)

export const CheckIcon = (p: Props) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.7 2.7L16 9.5" />
  </Icon>
)

export const AlertIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 3.5 2.5 20h19L12 3.5z" />
    <path d="M12 10v4.5M12 17.3v.2" />
  </Icon>
)

export const LockIcon = (p: Props) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Icon>
)

export const SparkIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M19 16v4M17 18h4" />
  </Icon>
)

export const ChevronIcon = (p: Props) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)

export const CloseIcon = (p: Props) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)
