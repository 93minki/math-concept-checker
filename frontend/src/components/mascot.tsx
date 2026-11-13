/**
 * "개념이" — the service mascot: a student checking a math concept.
 * Flat two-tone SVG on theme tokens so it reads in light and dark mode
 * (astryx docs illustrations). Decorative: the text beside it carries the
 * meaning, so it is hidden from screen readers. Motion stops under
 * prefers-reduced-motion (globals.css "mascot").
 */
export type MascotMood = "thinking" | "resting" | "waving";

export default function Mascot({
  mood,
  size = 160,
}: {
  mood: MascotMood;
  size?: number;
}) {
  return (
    <svg
      className={`mascot mascot-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 160 160"
      aria-hidden="true"
      focusable="false"
    >
      {/* floor shadow */}
      <ellipse className="mascot-shadow" cx="80" cy="148" rx="38" ry="6" />

      <g className="mascot-body">
        {/* body / hoodie */}
        <path
          className="mascot-fill-accent"
          d="M44 146c0-22 16-38 36-38s36 16 36 38z"
        />
        <path className="mascot-fill-card" d="M72 112h16l-8 12z" />
        {/* head */}
        <circle
          className="mascot-fill-card mascot-line"
          cx="80"
          cy="70"
          r="34"
        />
        {/* hair */}
        <path
          className="mascot-fill-ink"
          d="M47 64c2-20 17-32 35-32 16 0 29 9 32 24-9-6-20-8-31-6-13 2-25 8-36 14z"
        />
        {/* cheeks */}
        <circle className="mascot-cheek" cx="61" cy="82" r="5" />
        <circle className="mascot-cheek" cx="99" cy="82" r="5" />

        {/* eyes: open (thinking, waving) or closed (resting) */}
        {mood === "resting" ? (
          <g className="mascot-stroke-ink">
            <path d="M62 72q6 5 12 0" />
            <path d="M86 72q6 5 12 0" />
          </g>
        ) : (
          <g className="mascot-eyes">
            <circle className="mascot-fill-ink" cx="68" cy="72" r="4" />
            <circle className="mascot-fill-ink" cx="92" cy="72" r="4" />
          </g>
        )}
        {/* mouth */}
        {mood === "waving" ? (
          <path className="mascot-stroke-ink" d="M72 86q8 8 16 0" />
        ) : mood === "thinking" ? (
          <path className="mascot-stroke-ink" d="M75 88h10" />
        ) : (
          <path className="mascot-stroke-ink" d="M74 88q6 3 12 0" />
        )}

        {/* hands */}
        {mood === "waving" ? (
          <g className="mascot-wave">
            <circle
              className="mascot-fill-card mascot-line"
              cx="122"
              cy="98"
              r="8"
            />
          </g>
        ) : (
          <g className="mascot-pencil">
            <circle
              className="mascot-fill-card mascot-line"
              cx="112"
              cy="122"
              r="7"
            />
            <path className="mascot-fill-ink" d="M112 122l16-26 6 4-16 26z" />
            <path className="mascot-fill-accent" d="M128 96l3-5 6 4-3 5z" />
          </g>
        )}
      </g>

      {/* what the mascot is thinking about */}
      {mood === "thinking" && (
        <g className="mascot-bubble">
          <circle className="mascot-dot mascot-dot-1" cx="118" cy="40" r="4" />
          <circle className="mascot-dot mascot-dot-2" cx="132" cy="30" r="4" />
          <circle className="mascot-dot mascot-dot-3" cx="146" cy="20" r="4" />
        </g>
      )}
      {mood === "resting" && (
        <g className="mascot-zz mascot-stroke-accent">
          <path d="M116 34h12l-12 12h12" />
          <path d="M134 18h8l-8 8h8" />
        </g>
      )}
      {mood === "waving" && (
        <g className="mascot-check">
          <rect
            className="mascot-fill-accent"
            x="18"
            y="20"
            width="34"
            height="20"
            rx="10"
          />
          <circle className="mascot-fill-card" cx="42" cy="30" r="7" />
          <path className="mascot-stroke-accent" d="M38.5 30l2.5 2.5 4.5-5" />
        </g>
      )}
    </svg>
  );
}
