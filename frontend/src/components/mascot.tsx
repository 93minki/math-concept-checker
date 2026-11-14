import Image from "next/image";

/**
 * "개념이" — the service mascot, one 3D picture per mood (user 2026-11-14).
 * The text beside it carries the meaning, so the picture is hidden from
 * screen readers. The picture does not move.
 */
export type MascotMood = "thinking" | "resting" | "waving" | "waiting";
const pictures: Record<MascotMood, string> = {
  thinking: "/images/mascot/gaenyeom-thinking.webp",
  resting: "/images/mascot/gaenyeom-resting.webp",
  waving: "/images/mascot/gaenyeom-cheer.webp",
  waiting: "/images/mascot/gaenyeom-waiting.webp",
};

export default function Mascot({
  mood,
  size = 160,
}: {
  mood: MascotMood;
  size?: number;
}) {
  return (
    <span className={`mascot mascot-${mood}`} aria-hidden="true">
      <Image
        src={pictures[mood]}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
      />
    </span>
  );
}
