"use client";

/**
 * /profile → /u/[dragverse-handle] redirect.
 * Fetches the user's Dragverse handle (not Bluesky handle) from /api/user/me.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { LoadingShimmer } from "@/components/shared";

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { ready, authenticated, login, getAccessToken } = usePrivy();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      login();
      return;
    }

    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch("/api/user/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const handle = data.creator?.handle || data.profile?.handle;
        if (handle) {
          router.replace(`/u/${handle}`);
        }
      } catch {
        // silent — stay on loading
      }
    })();
  }, [ready, authenticated, login, getAccessToken, router]);

  return <LoadingShimmer />;
}
