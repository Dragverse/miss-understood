"use client";

import { SiTwitch } from "react-icons/si";

/**
 * Links out to the creator's Twitch channel.
 *
 * Matches the other social badges in the profile handle row.
 */
export function TwitchBadge({ handle }: { handle: string }) {
  const clean = handle.trim().replace(/^@/, "");
  if (!clean) return null;

  return (
    <a
      href={`https://twitch.tv/${encodeURIComponent(clean)}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`@${clean} on Twitch`}
      aria-label={`${clean} on Twitch`}
      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[#9146FF] hover:bg-white/10 transition-colors"
    >
      <SiTwitch className="w-4 h-4" />
    </a>
  );
}
