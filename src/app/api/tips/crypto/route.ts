import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { validateBody, cryptoTipSchema } from "@/lib/validation/schemas";

/**
 * POST /api/tips/crypto
 * Track crypto tip transactions
 *
 * This endpoint records crypto tips sent via Web3 wallets (ETH/USDC on Base network)
 * Once Phase 3 (Ceramic) is configured, tips will be saved to the Transaction model
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    let userId: string | undefined;
    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = auth.userId;
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(cryptoTipSchema, body);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { toDID, amount, currency, txHash, videoId } =
      validation.data;

    // TODO: Once Ceramic is configured, save to Transaction model
    // Example implementation:
    // import { createTransaction } from "@/lib/supabase/transactions";
    //
    // const transaction = await createTransaction({
    //   fromDID: userId || "anonymous",
    //   toDID,
    //   amount,
    //   currency,
    //   paymentType: "crypto",
    //   txHash,
    //   videoID: videoId,
    //   status: "completed",
    //   message,
    //   createdAt: new Date().toISOString(),
    // });

    console.log("Crypto tip recorded:", {
      userId,
      toDID,
      amount,
      currency,
      txHash,
      videoId,
    });

    return NextResponse.json({
      success: true,
      message: "Tip recorded successfully",
      transactionId: `mock-${Date.now()}`,
      // Once Ceramic is configured, return: transactionId: transaction.id
    });
  } catch (error) {
    console.error("Crypto tip error:", error);
    return NextResponse.json({ error: "Failed to record tip" }, { status: 500 });
  }
}

/**
 * GET /api/tips/crypto
 * Get crypto tip history for a creator
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorDID = searchParams.get("creatorDID");

    if (!creatorDID) {
      return NextResponse.json(
        { error: "Missing creatorDID parameter" },
        { status: 400 }
      );
    }

    // Validate DID format
    if (!creatorDID.startsWith("did:")) {
      return NextResponse.json({ error: "Invalid DID format" }, { status: 400 });
    }

    // TODO: Once Ceramic is configured, query transactions
    // import { getTransactionsByCreator } from "@/lib/supabase/transactions";
    // const transactions = await getTransactionsByCreator(creatorDID, "crypto");

    return NextResponse.json({
      transactions: [],
      totalEarnings: {
        ETH: 0,
        USDC: 0,
      },
      message: "Ceramic pending configuration",
    });
  } catch (error) {
    console.error("Get crypto tips error:", error);
    return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 });
  }
}
