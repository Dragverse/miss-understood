"use client";

import type { ComponentType } from "react";
import {
  FiUser,
  FiCalendar,
  FiImage,
  FiFilm,
  FiMusic,
  FiRadio,
  FiLink,
  FiType,
  FiBriefcase,
  FiCode,
  FiUsers,
  FiDollarSign,
  FiEdit3,
} from "react-icons/fi";
import type { IconType } from "react-icons";

import {
  AboutBlock,
  BookingBlock,
  FeaturedFriendsBlock,
  GalleryBlock,
  LinksBlock,
  MusicBlock,
  TextBlock,
  VideoShowcaseBlock,
  type BlockContent,
  type BlockViewProps,
} from "@/components/blocks";
import { BlockEmpty } from "@/components/blocks/block-shell";
import { defaultConfigFor } from "./schemas";
import type { BlockType } from "./types";

export interface BlockDefinition {
  /** Default heading, overridable per block via `profile_blocks.title`. */
  label: string;
  icon: IconType;
  /** One-liner shown in the "add block" picker. */
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  view: ComponentType<BlockViewProps<any>>;
  /**
   * False while the backing feature doesn't exist yet. Such blocks still
   * render (the migration backfills some of them) but aren't offered in the
   * picker, so a creator can't add something that will look broken.
   */
  addable: boolean;
}

/**
 * Builds a placeholder view for block types whose backing feature ships in a
 * later phase. Returns a component, so call it at registry-definition time.
 */
function notYetBlock(message: string): ComponentType<BlockViewProps> {
  const Placeholder: ComponentType<BlockViewProps> = () => <BlockEmpty message={message} />;
  Placeholder.displayName = "NotYetBlock";
  return Placeholder;
}

export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  about: {
    label: "About me",
    icon: FiUser,
    description: "Bio, pronouns, where you're based, drag family.",
    view: AboutBlock,
    addable: true,
  },
  video_showcase: {
    label: "Videos",
    icon: FiFilm,
    description: "Pin your best videos, or show the newest automatically.",
    view: VideoShowcaseBlock,
    addable: true,
  },
  gallery: {
    label: "Gallery",
    icon: FiImage,
    description: "A grid of your photos.",
    view: GalleryBlock,
    addable: true,
  },
  music: {
    label: "Music",
    icon: FiMusic,
    description: "Your tracks and mixes as a playlist.",
    view: MusicBlock,
    addable: true,
  },
  links: {
    label: "Links",
    icon: FiLink,
    description: "Anywhere else people can find you.",
    view: LinksBlock,
    addable: true,
  },
  text: {
    label: "Note",
    icon: FiType,
    description: "Say anything. Plain text, your words.",
    view: TextBlock,
    addable: true,
  },
  booking: {
    label: "Book me",
    icon: FiBriefcase,
    description: "How promoters get hold of you, and what you need.",
    view: BookingBlock,
    addable: true,
  },

  // --- Ship in later phases -------------------------------------------------
  upcoming: {
    label: "Upcoming",
    icon: FiCalendar,
    description: "Your gigs, shows and streams.",
    view: notYetBlock("No dates listed yet."),
    addable: false, // events land in phase 2
  },
  livestream: {
    label: "Live",
    icon: FiRadio,
    description: "Show when you're live, and what's next.",
    view: notYetBlock("Not live right now."),
    addable: false,
  },
  embed: {
    label: "Embed",
    icon: FiCode,
    description: "YouTube, Bandcamp, Spotify or SoundCloud.",
    view: notYetBlock("Nothing embedded yet."),
    addable: false,
  },
  featured_friends: {
    label: "Friends",
    icon: FiUsers,
    description: "Point at the creators you love.",
    view: FeaturedFriendsBlock,
    addable: false, // phase 4
  },
  tip_jar: {
    label: "Tip jar",
    icon: FiDollarSign,
    description: "Let people support you directly.",
    view: notYetBlock("Tipping coming soon."),
    addable: false,
  },
  guestbook: {
    label: "Guestbook",
    icon: FiEdit3,
    description: "Let people sign your page.",
    view: notYetBlock("No messages yet."),
    addable: false, // phase 4
  },
};

/** Block types a creator can add right now, in picker order. */
export function addableBlockTypes(): BlockType[] {
  return (Object.keys(BLOCK_REGISTRY) as BlockType[]).filter(
    (type) => BLOCK_REGISTRY[type].addable
  );
}

export function blockLabel(type: BlockType, override?: string | null): string {
  return override?.trim() || BLOCK_REGISTRY[type]?.label || type;
}

export { defaultConfigFor };
export type { BlockContent };
