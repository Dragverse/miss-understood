/**
 * Shortened public profile URL route: /u/[handle]
 * Redirects to /profile/[handle] for cleaner sharing links
 */

import { redirect } from "next/navigation";

export default async function ShortProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  // Redirect to full profile route
  redirect(`/profile/${handle}`);
}
