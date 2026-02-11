/**
 * Farcaster follower fetching and syncing
 * Pulls follower data from Farcaster hubs and syncs to database
 */

import { getSSLHubRpcClient } from "@farcaster/hub-nodejs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HUB_URL = process.env.FARCASTER_HUB_URL || "nemes.farcaster.xyz:2283";

interface FarcasterFollower {
  fid: number; // Follower's Farcaster ID
  timestamp: Date; // When they followed
}

/**
 * Fetch followers for a given FID from Farcaster hub
 */
export async function fetchFarcasterFollowers(
  fid: number
): Promise<FarcasterFollower[]> {
  try {
    console.log(`[Farcaster Followers] Fetching followers for FID ${fid}...`);

    const client = getSSLHubRpcClient(HUB_URL);
    const followers: FarcasterFollower[] = [];

    // Fetch links where the target is this FID (people following this user)
    const linksResult = await client.getLinksByTarget({
      targetFid: fid,
      linkType: "follow",
    });

    if (linksResult.isErr()) {
      console.error(
        `[Farcaster Followers] Failed to fetch followers:`,
        linksResult.error
      );
      return [];
    }

    const messages = linksResult.value.messages;

    for (const message of messages) {
      if (message.data?.linkBody) {
        followers.push({
          fid: message.data.fid,
          timestamp: new Date(message.data.timestamp * 1000), // Convert Unix timestamp
        });
      }
    }

    console.log(`[Farcaster Followers] ✅ Found ${followers.length} followers`);
    return followers;
  } catch (error) {
    console.error("[Farcaster Followers] Error fetching followers:", error);
    return [];
  }
}

/**
 * Sync Farcaster followers to database for a user
 */
export async function syncFarcasterFollowers(
  userDID: string,
  fid: number
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Fetch followers from Farcaster
    const followers = await fetchFarcasterFollowers(fid);

    if (followers.length === 0) {
      console.log(`[Farcaster Followers] No followers found for FID ${fid}`);
      return { success: true, count: 0 };
    }

    // Get user's internal creator ID
    const { data: creator } = await supabase
      .from("creators")
      .select("id")
      .eq("did", userDID)
      .single();

    if (!creator) {
      return {
        success: false,
        count: 0,
        error: "Creator not found",
      };
    }

    // Store followers in database
    // Note: We'll need to create a farcaster_followers table
    const followRecords = followers.map((follower) => ({
      creator_id: creator.id,
      follower_fid: follower.fid,
      followed_at: follower.timestamp.toISOString(),
      source: "farcaster",
    }));

    // Upsert followers (avoid duplicates)
    const { error } = await supabase
      .from("followers")
      .upsert(followRecords, {
        onConflict: "creator_id,follower_fid,source",
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(
        "[Farcaster Followers] Failed to store followers:",
        error
      );
      return {
        success: false,
        count: 0,
        error: "Failed to store followers in database",
      };
    }

    console.log(
      `[Farcaster Followers] ✅ Synced ${followers.length} followers for ${userDID}`
    );

    return {
      success: true,
      count: followers.length,
    };
  } catch (error) {
    console.error("[Farcaster Followers] Sync error:", error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get follower count breakdown by source for a creator
 */
export async function getFollowerBreakdown(
  creatorId: string
): Promise<{
  total: number;
  bySource: {
    dragverse: number;
    bluesky: number;
    farcaster: number;
  };
}> {
  try {
    // Count followers by source
    const { data, error } = await supabase
      .from("followers")
      .select("source")
      .eq("creator_id", creatorId);

    if (error || !data) {
      return {
        total: 0,
        bySource: { dragverse: 0, bluesky: 0, farcaster: 0 },
      };
    }

    const breakdown = {
      dragverse: 0,
      bluesky: 0,
      farcaster: 0,
    };

    data.forEach((follower) => {
      const source = follower.source as keyof typeof breakdown;
      if (source in breakdown) {
        breakdown[source]++;
      }
    });

    return {
      total: data.length,
      bySource: breakdown,
    };
  } catch (error) {
    console.error("[Farcaster Followers] Breakdown error:", error);
    return {
      total: 0,
      bySource: { dragverse: 0, bluesky: 0, farcaster: 0 },
    };
  }
}
