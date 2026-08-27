"use client";

export const PROFILE_TABS = ["user", "videos", "audio", "events", "notes"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

const TAB_LABELS: Record<ProfileTab, string> = {
  user: "User",
  videos: "Videos",
  audio: "Audio",
  events: "Events",
  notes: "Notes",
};

export function isProfileTab(value: string | null): value is ProfileTab {
  return !!value && (PROFILE_TABS as readonly string[]).includes(value);
}

/**
 * Profile tab bar. `user` is the creator's board and is always present; the
 * rest only appear when they have something to show, so a new creator sees a
 * single tab rather than four empty ones.
 */
export function ProfileTabs({
  active,
  available,
  onChange,
}: {
  active: ProfileTab;
  available: ReadonlySet<ProfileTab>;
  onChange: (tab: ProfileTab) => void;
}) {
  const tabs = PROFILE_TABS.filter((tab) => tab === "user" || available.has(tab));

  // A lone "User" tab is just a label for the only thing on screen.
  if (tabs.length <= 1) return null;

  return (
    <nav
      aria-label="Profile sections"
      className="flex justify-center gap-6 sm:gap-10 flex-wrap px-4 py-5"
    >
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            aria-current={isActive ? "page" : undefined}
            className={`font-heading text-lg sm:text-xl uppercase tracking-tight transition-colors ${
              isActive
                ? "text-[color:var(--board-accent,var(--color-dragverse-primary))]"
                : "text-white/45 hover:text-white/80"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        );
      })}
    </nav>
  );
}
