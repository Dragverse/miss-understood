import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, isPrivyConfigured } from "@/lib/auth/verify";
import { getSupabaseServerClient } from "@/lib/supabase/client";
import { getCreatorByDID } from "@/lib/supabase/creators";
import { updateThemeSchema } from "@/lib/blocks/schemas";
import { validateBody } from "@/lib/validation/schemas";
import { isAllowedBackgroundUrl, ensureReadableAccent } from "@/lib/blocks/theme";

export const dynamic = "force-dynamic";

/**
 * PUT /api/board/theme
 * Update the authenticated creator's board theme.
 */
export async function PUT(request: NextRequest) {
  try {
    if (!isPrivyConfigured()) {
      return NextResponse.json({ error: "Authentication not configured" }, { status: 500 });
    }

    const auth = await verifyAuth(request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const creatorDid = auth.userId;

    const parsed = validateBody(updateThemeSchema, await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.data;

    // A background image must live on our own storage. An arbitrary remote URL
    // is both a tracking leak (the host sees every visitor's IP) and a way to
    // swap the image for something else after moderation has looked at it.
    if (input.backgroundKind === "image" && input.backgroundValue) {
      if (!isAllowedBackgroundUrl(input.backgroundValue)) {
        return NextResponse.json(
          { error: "Background images must be uploaded to Dragverse" },
          { status: 400 }
        );
      }
    }

    const creator = await getCreatorByDID(creatorDid);
    if (!creator) {
      return NextResponse.json({ error: "Creator profile not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      creator_did: creatorDid,
      creator_id: creator.id,
    };

    if (input.accentColor !== undefined) {
      // Nudge rather than reject: a creator picking a colour that fails
      // contrast gets the nearest readable shade, not an error dialog.
      const { color, adjusted } = input.accentColor
        ? ensureReadableAccent(input.accentColor)
        : { color: null, adjusted: false };
      updateData.accent_color = color;
      updateData._adjusted = adjusted;
    }
    if (input.backgroundKind !== undefined) updateData.background_kind = input.backgroundKind;
    if (input.backgroundValue !== undefined) updateData.background_value = input.backgroundValue;
    if (input.backgroundTile !== undefined) updateData.background_tile = input.backgroundTile;
    if (input.fontPair !== undefined) updateData.font_pair = input.fontPair;
    if (input.cardStyle !== undefined) updateData.card_style = input.cardStyle;
    if (input.colorScheme !== undefined) updateData.color_scheme = input.colorScheme;

    const adjusted = updateData._adjusted === true;
    delete updateData._adjusted;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("creator_themes")
      .upsert(updateData, { onConflict: "creator_did" })
      .select()
      .single();

    if (error) {
      console.error("[Board] Failed to save theme:", error);
      return NextResponse.json({ error: "Failed to save theme" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      theme: data,
      ...(adjusted
        ? { notice: "Accent colour was adjusted slightly so text stays readable." }
        : {}),
    });
  } catch (error) {
    console.error("[Board] Theme error:", error);
    return NextResponse.json({ error: "Failed to save theme" }, { status: 500 });
  }
}
