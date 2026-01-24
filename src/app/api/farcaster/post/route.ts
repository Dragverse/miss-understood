import { NextRequest, NextResponse } from "next/server";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getPrivyClient } from "@/lib/privy/server";

/**
 * POST /api/farcaster/post
 * Cross-post content to Farcaster /dragverse channel
 *
 * Request body:
 * - text: string (cast text content)
 * - videoUrl?: string (optional video embed)
 * - imageUrl?: string (optional image embed)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, videoUrl, imageUrl } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { success: false, error: "Text content is required" },
        { status: 400 }
      );
    }

    // Verify authentication
    if (!isPrivyConfigured()) {
      return NextResponse.json(
        { success: false, error: "Authentication system not configured" },
        { status: 500 }
      );
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    // Fetch user's Privy profile to get Farcaster account
    const privyClient = getPrivyClient();
    const user = await privyClient.users()._get(auth.userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user has Farcaster linked
    const farcasterAccount = user.linked_accounts?.find(
      (account: any) => account.type === "farcaster"
    ) as any;

    if (!farcasterAccount?.fid) {
      return NextResponse.json(
        {
          success: false,
          error: "Farcaster not connected",
          message: "Please connect your Farcaster account in Settings to cross-post",
        },
        { status: 400 }
      );
    }

    // Initialize Neynar client
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      console.error("[Farcaster Post] NEYNAR_API_KEY not configured");
      return NextResponse.json(
        {
          success: false,
          error: "Farcaster integration not configured",
        },
        { status: 500 }
      );
    }

    const neynar = new NeynarAPIClient({ apiKey });

    // Get signer UUID from Privy (if available)
    const signerUuid = (farcasterAccount as any).signerUuid;
    if (!signerUuid) {
      console.warn("[Farcaster Post] No signer UUID found for user", user.id);
      return NextResponse.json(
        {
          success: false,
          error: "Farcaster signer not configured",
          message: "Please reconnect your Farcaster account",
        },
        { status: 400 }
      );
    }

    // Prepare embeds
    const embeds: Array<{ url: string }> = [];
    if (videoUrl) embeds.push({ url: videoUrl });
    if (imageUrl) embeds.push({ url: imageUrl });

    console.log("[Farcaster Post] Publishing cast to /dragverse channel", {
      fid: farcasterAccount.fid,
      textLength: text.length,
      embedCount: embeds.length,
    });

    // Publish cast to Farcaster /dragverse channel
    const cast = await neynar.publishCast({
      signerUuid,
      text,
      embeds: embeds.length > 0 ? embeds : undefined,
      channelId: "dragverse", // Post to your /dragverse channel
    });

    console.log("[Farcaster Post] ✅ Cast published successfully", {
      castHash: (cast as any).hash || (cast as any).cast?.hash,
      channelId: "dragverse",
    });

    // Extract hash from response (API structure may vary)
    const castHash = (cast as any).hash || (cast as any).cast?.hash;

    return NextResponse.json({
      success: true,
      cast: {
        hash: castHash,
        url: castHash ? `https://warpcast.com/~/conversations/${castHash}` : undefined,
      },
    });
  } catch (error: any) {
    console.error("[Farcaster Post] Failed to publish cast:", error);

    // Handle specific Neynar API errors
    if (error.response?.status === 401) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Farcaster credentials",
          message: "Please reconnect your Farcaster account",
        },
        { status: 401 }
      );
    }

    if (error.response?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded",
          message: "Too many posts. Please try again later.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to post to Farcaster",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
