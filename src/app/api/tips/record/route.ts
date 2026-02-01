import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { checkRateLimit } from "@/lib/utils/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 10 tips per minute per user
    const rateLimit = checkRateLimit(auth.userId, 10, 60000);
    if (!rateLimit.allowed) {
      const resetInSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          resetInSeconds
        },
        {
          status: 429,
          headers: {
            "Retry-After": resetInSeconds.toString(),
            "X-RateLimit-Limit": "10",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetTime.toString(),
          }
        }
      );
    }

    const { from, to, amount, amountUSD, txHash, token } = await request.json();

    // Validate inputs
    if (!from || !to || !amountUSD || !txHash) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate Ethereum address format
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(from) || !ethAddressRegex.test(to)) {
      return NextResponse.json({ error: "Invalid Ethereum address" }, { status: 400 });
    }

    // Validate amount
    const tipAmount = parseFloat(amountUSD);
    if (isNaN(tipAmount) || tipAmount <= 0 || tipAmount > 100) {
      return NextResponse.json({ error: "Invalid amount. Must be between $0.01 and $100" }, { status: 400 });
    }

    // Validate transaction hash format
    const txHashRegex = /^0x[a-fA-F0-9]{64}$/;
    if (!txHashRegex.test(txHash)) {
      return NextResponse.json({ error: "Invalid transaction hash" }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    // Check if transaction already exists (double-spend protection)
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("tx_hash", txHash)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Transaction already recorded" }, { status: 409 });
    }

    const { error } = await supabase.from("transactions").insert({
      from_address: from,
      to_address: to,
      amount_usd: amountUSD,
      tx_hash: txHash,
      token: token || "USDC",
      type: "tip",
      network: "base",
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[Tips Record] Error:", error);
      return NextResponse.json({ error: "Failed to record tip" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Tips Record] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
