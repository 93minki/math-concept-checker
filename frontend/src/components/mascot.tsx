import Image from "next/image";

/**
 * "개념이" — the service mascot, one 3D picture per mood (user 2026-11-14).
 * The text beside it carries the meaning, so the picture is hidden from
 * screen readers. The picture does not move.
 */
export type MascotMood = "thinking" | "resting" | "waving" | "waiting";
const pictures: Record<MascotMood, string> = {
  thinking: "/images/mascot/gaenyeom-thinking.png",
  resting: "/images/mascot/gaenyeom-resting.png",
  waving: "/images/mascot/gaenyeom-cheer.png",
  waiting: "/images/mascot/gaenyeom-waiting.png",
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
