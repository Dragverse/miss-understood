import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { from, to, amount, amountUSD, txHash, token } = await request.json();

    const supabase = getSupabaseServerClient();
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
