/**
 * Shortened public profile URL route: /u/[handle]
 * Redirects to /profile/[handle] for cleaner sharing links
 */

import { redirect } from "next/navigation";

export default function ShortProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  // Redirect to full profile route
  redirect(`/profile/${params.handle}`);
}
