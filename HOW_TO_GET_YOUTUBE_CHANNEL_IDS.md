# How to Get YouTube Channel IDs

## Quick Method (Recommended)

1. **Visit the channel page:**
   - Go to `https://www.youtube.com/@HANDLENAME`
   - Example: `https://www.youtube.com/@EllisMiah`

2. **View Page Source:**
   - Right-click on the page → "View Page Source"
   - OR press `Cmd+Option+U` (Mac) or `Ctrl+U` (Windows/Linux)

3. **Search for Channel ID:**
   - Press `Cmd+F` (Mac) or `Ctrl+F` (Windows) to open search
   - Search for: `"channelId"`
   - The channel ID will be in format: `"channelId":"UCxxxxxxxxxxxxxxxxxx"`
   - Channel IDs always start with `UC` and are 24 characters long

4. **Copy the ID:**
   - Copy just the ID part (e.g., `UCb3Oph7yUq5jPDO1Q61qcMw`)
   - Paste it into the `channelId` field in `channels.ts`

---

## Alternative Method: Using YouTube URL

Some channels show their ID in the URL:
- Old format: `https://www.youtube.com/channel/UC-xxxxx`
- New format: `https://www.youtube.com/@handlename` (ID hidden, use method above)

---

## Channels That Need Real IDs

### In `src/lib/youtube/channels.ts`:

**Lines 110-205** - All have placeholder IDs like "UCb7b7b7b7b7b7b7b7b7b7bQ"

**Newly Added (need IDs):**
- Ellis Miah (`@ellismiah`)
- Trixie Cosmetics brand channel
- Patrick Starrr (`@patrickstarrr`)
- Miss Vanjie
- Raven Beauty

**To Fix:**
1. The Vivienne
2. Bimini Bon-Boulash
3. Peppermint
4. Brooke Lynn Hytes
5. Landon Cider
6. The Boulet Brothers
7. Victoria Stone
8. Scarlet Envy
9. Crystal Methyd
10. Yvie Oddly
11. Sharon Needles
12. Courtney Act
13. Latrice Royale
14. Heidi N Closet
15. Kandy Ho
16. Dragula Official

---

## Verification

After adding a channel ID, test it by:

```bash
curl "https://www.youtube.com/feeds/videos.xml?channel_id=YOUR_CHANNEL_ID"
```

If it returns XML with video entries, the ID is correct!

---

## Important Notes

- **Channels without valid IDs will silently fail** (no errors, just no content)
- The first 15 channels (lines 19-108) already have valid IDs and work correctly
- RSS feeds update every 15 minutes on YouTube's side
- Our app caches RSS responses for 1 hour

---

## Current Working Channels (Lines 19-108)

✅ Already have valid IDs:
1. RuPaul's Drag Race - `UC0sEIyXXalzD1lbwm3D2xpA`
2. WOW Presents - `UCUUUpaMp8DV6KUOfQwoIiLg`
3. Trixie Mattel - `UC_gYMGjaNE8xvgb-fE1lZoA`
4. Bob The Drag Queen - `UCjWn3aYXWU8BvyFQqOZiGWg`
5. Bianca Del Rio - `UCEoxBX0HP6H2BoCLLYFPYsg`
6. Katya - `UCb3Oph7yUq5jPDO1Q61qcMw`
7. Sasha Velour - `UCeHAShKyGQIJ262xboI0oVQ`
8. Manila Luzon - `UC7-S6iRXVUQ2AsVjrJC-xfg`
9. Alyssa Edwards - `UCSKnlPjYji7RJbvPxPepgfA`
10. Jinkx Monsoon - `UCqGh3IjZ02rlBjq1u9g4eHw`
11. Willam - `UCuhKIYy7mOh76V7dWh600Mg`
12. Violet Chachki - `UCOTowPfU-1M-7l6hGE5l3xg`
13. Kim Chi - `UCLFvHz1W9TKPPYVr8U0AJPA`
14. Adore Delano - `UCfFEFk3yQ7eXqVTmQWUXQAQ`
15. Gottmik - `UCLuuQ4eZQd0RSHYJ6R-4VdQ`

These 15 channels are currently providing YouTube content to your homepage, /videos, and /shorts pages.
