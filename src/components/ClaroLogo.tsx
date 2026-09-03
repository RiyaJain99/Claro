type Props = {
  size?: number
  className?: string
}

export default function ClaroLogo({ size = 16, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.5 7.5 C4.5 7.5 8 13 12.5 13 C16 13 18.3 10.7 19.3 9"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <line x1="6" y1="16" x2="15" y2="16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}
