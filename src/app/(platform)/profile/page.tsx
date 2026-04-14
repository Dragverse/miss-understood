"use client";

/**
 * /profile → /u/[handle] redirect.
 * Sends authenticated users straight to their canonical profile URL.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/privy/hooks";
import { LoadingShimmer } from "@/components/shared";

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, userHandle, signIn } = useAuthUser();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      signIn();
      return;
    }
    if (userHandle) {
      router.replace(`/u/${userHandle}`);
    }
  }, [isReady, isAuthenticated, userHandle, router, signIn]);

  return <LoadingShimmer />;
}
