// Service icon: a switch turned on, "concept understanding is on".
// Same drawing as src/app/icon.svg (favicon). Decorative: the brand name is
// the link's text.
export default function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 32 32"
      width="28"
      height="28"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="#6744c5" />
      <rect x="4" y="9" width="24" height="14" rx="7" fill="#fff" />
      <circle cx="21" cy="16" r="5.5" fill="#6744c5" />
      <path
        d="M18.6 16.2l1.8 2 3.1-4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
