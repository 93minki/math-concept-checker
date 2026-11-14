import Image from "next/image";

/**
 * "개념이" — the service mascot. One decorative picture for every mood.
 * The text beside it carries the meaning, so the picture is hidden from
 * screen readers. The picture does not move.
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
    <span className={`mascot mascot-${mood}`} aria-hidden="true">
      <Image
        src="/images/mascot/gaenyeom-cheer.png"
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
      />
    </span>
  );
}
