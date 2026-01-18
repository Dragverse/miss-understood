import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { validateBody, uploadRequestSchema } from "@/lib/validation/schemas";

const LIVEPEER_API_URL = "https://livepeer.studio/api";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    if (isPrivyConfigured()) {
      const auth = await verifyAuth(request);
      if (!auth.authenticated) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    const apiKey = process.env.LIVEPEER_API_KEY;

    if (!apiKey) {
      console.error("LIVEPEER_API_KEY is not configured");
      return NextResponse.json(
        { error: "Livepeer API key not configured. Please set LIVEPEER_API_KEY environment variable." },
        { status: 503 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = validateBody(uploadRequestSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name } = validation.data;

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
      console.error("Livepeer API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: `${LIVEPEER_API_URL}/asset/request-upload`
      });
      return NextResponse.json(
        {
          error: "Failed to get upload URL from Livepeer",
          details: response.status === 401 ? "Invalid API key" : errorText.substring(0, 100)
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      tusEndpoint: data.tusEndpoint,
      asset: data.asset,
    });
  } catch (error) {
    console.error("Upload request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
