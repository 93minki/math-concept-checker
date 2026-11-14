type IconName =
  | "play"
  | "check"
  | "chart"
  | "book"
  | "pencil"
  | "trophy"
  | "target"
  | "search"
  | "growth"
  | "report"
  | "cap";
export default function LandingIcon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "play" && <path d="M8 5v14l11-7z" fill="currentColor" />}
      {name === "check" && <path d="m4 12 5 5L20 6" />}
      {name === "chart" && (
        <>
          <path d="M4 20V13h4v7M10 20V9h4v11M16 20V4h4v16" />
        </>
      )}
      {name === "book" && (
        <>
          <path d="M12 20c-2-2-5-2-9-2V5c4-1 7 0 9 2 2-2 5-3 9-2v13c-4 0-7 0-9 2z" />
          <path d="M12 7v13" />
        </>
      )}
      {name === "pencil" && (
        <>
          <path d="m4 16 11-11 4 4L8 20l-4 1z" />
          <path d="m13 7 4 4" />
        </>
      )}
      {name === "trophy" && (
        <>
          <path d="M7 4h10v5c0 4-2 6-5 6s-5-2-5-6zM7 6H3c0 4 2 6 5 6M17 6h4c0 4-2 6-5 6M12 15v4M8 21h8" />
        </>
      )}
      {name === "target" && (
        <>
          <circle cx="11" cy="13" r="8" />
          <circle cx="11" cy="13" r="4" />
          <path d="m11 13 9-9m-3 0h3v3" />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="10" cy="10" r="7" />
          <path d="m15 15 5 5" />
        </>
      )}
      {name === "growth" && (
        <>
          <path d="M4 20v-6h4v6M10 20v-9h4v9M16 20V7h4v13M4 9l5-3 4 2 7-5" />
        </>
      )}
      {name === "report" && (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8M8 11h8M8 17v-3m4 3v-5m4 5v-7" />
        </>
      )}
      {name === "cap" && (
        <>
          <path d="m2 9 10-5 10 5-10 5zM6 11v5c3 3 9 3 12 0v-5M22 9v7" />
        </>
      )}
    </svg>
  );
}
