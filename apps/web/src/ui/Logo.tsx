export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="112" fill="var(--brand)" />
      <g fill="none" stroke="#fff" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round">
        <path d="M176 400V112" />
        <path d="M176 300c0-72 160-60 160-132" />
      </g>
      <circle cx="176" cy="112" r="36" fill="#fff" />
      <circle cx="336" cy="150" r="36" fill="#fff" />
      <circle cx="176" cy="400" r="36" fill="#fff" />
    </svg>
  );
}
