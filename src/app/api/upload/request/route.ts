import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { validateBody, uploadRequestSchema } from "@/lib/validation/schemas";

const LIVEPEER_API_URL = "https://livepeer.studio/api";

export async function POST(request: NextRequest) {
  try {
    console.log("📤 Upload request received");

    // Verify authentication
    if (isPrivyConfigured()) {
      console.log("🔐 Verifying Privy authentication...");
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        console.error("[UploadRequest] Authentication failed:", auth.error);
        return NextResponse.json(
          {
            error: "Authentication required to upload content.",
            errorType: "UNAUTHORIZED"
          },
          { status: 401 }
        );
      }
      console.log("✓ User authenticated:", auth.userId);
    } else {
      console.log("⚠ Privy not configured - skipping auth");
    }

    const apiKey = process.env.LIVEPEER_API_KEY;

    if (!apiKey) {
      console.error("❌ LIVEPEER_API_KEY is not configured");
      return NextResponse.json(
        { error: "Livepeer API key not configured. Please set LIVEPEER_API_KEY environment variable." },
        { status: 503 }
      );
    }
    console.log("✓ Livepeer API key found");

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(uploadRequestSchema, body);

    if (!validation.success) {
      console.error("❌ Validation failed:", validation.error);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name } = validation.data;
    console.log("📁 Requesting upload URL for file:", name);

    // Request upload URL from Livepeer
    const response = await fetch(`${LIVEPEER_API_URL}/asset/request-upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Livepeer API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: `${LIVEPEER_API_URL}/asset/request-upload`
      });
      return NextResponse.json(
        {
          error: "Failed to get upload URL from Livepeer",
          details: response.status === 401 ? "Invalid API key - check Livepeer dashboard" : errorText.substring(0, 100)
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("✓ Upload URL received from Livepeer");

    return NextResponse.json({
      tusEndpoint: data.tusEndpoint,
      asset: data.asset,
    });
  } catch (error) {
    console.error("❌ Upload request error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined
      },
      { status: 500 }
    );
  }
}
