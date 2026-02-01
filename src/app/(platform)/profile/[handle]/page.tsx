/**
 * Legacy profile URL route: /profile/[handle]
 * Redirects to /u/[handle] for consistency
 */

import { redirect } from "next/navigation";

export default async function LegacyProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  // Redirect to short profile route
  redirect(`/u/${handle}`);
}
