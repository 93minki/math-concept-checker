import { EmptyState } from "@astryxdesign/core/EmptyState";
import type { ReactNode } from "react";
import Mascot, { type MascotMood } from "./mascot";

/**
 * Loading, empty and unavailable screens: the mascot inside Astryx
 * EmptyState (astryx docs illustrations: illustration in the icon slot,
 * title plus what to do next). `live` announces loading text politely.
 */
export default function StatusScreen({
  mood,
  title,
  description,
  actions,
  live = false,
  compact = false,
}: {
  mood: MascotMood;
  title: string;
  description?: string;
  actions?: ReactNode;
  live?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className="status-screen"
      {...(live ? { role: "status", "aria-live": "polite" as const } : {})}
    >
      <EmptyState
        icon={<Mascot mood={mood} size={compact ? 120 : 160} />}
        title={title}
        description={description}
        actions={actions}
        isCompact={compact}
        headingLevel={2}
      />
    </div>
  );
}
