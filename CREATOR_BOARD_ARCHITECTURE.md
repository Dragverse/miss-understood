# Creator Board Architecture

The pivot: Dragverse stops being a social network and becomes a set of **creator-owned boards**. A profile is not a feed of posts — it is a living page the artist arranges, where they list gigs, show photos and videos, go live, and share things with subscribers only.

This document is the design for that. Nothing here is built yet.

## Contents

- [What we're building on](#what-were-building-on)
- [The three pillars](#the-three-pillars)
- [Pillar 1 — The board](#pillar-1--the-board)
- [Pillar 2 — Events](#pillar-2--events)
- [Pillar 3 — Subscribers](#pillar-3--subscribers)
- [What happens to the social features](#what-happens-to-the-social-features)
- [The identity problem](#the-identity-problem)
- [Sequencing](#sequencing)
- [Open questions](#open-questions)

## What we're building on

Three primitives already in the codebase make this much cheaper than it looks.

**Access control exists.** [`video-access.ts`](src/lib/middleware/video-access.ts) already resolves `public | unlisted | private`, honours `video_share_tokens`, and writes `video_access_logs`. Subscriber gating is one more enum value and one more branch, not a new subsystem.

**Payment rails exist.** [`add_transactions_table.sql`](migrations/add_transactions_table.sql) records USDC-on-Base transfers with a `type` column already anticipating `'purchase'`. `creators.wallet_address` and `creators.stripe_account_id` are both already columns.

**Half an events system exists.** `streams.scheduled_at`, `videos.published_at` in the future, and `premiere_mode` are three separate ways of saying "this happens later." Events generalise all three.

**Theming is already token-based.** [`globals.css`](src/app/globals.css) declares everything under `@theme inline` as CSS custom properties (`--color-dragverse-primary`, `--color-bg-card`, `--spacing-card-gap`). Per-creator theming is a scoped override of those variables — no new styling architecture required.

What works against us: [`u/[handle]/page.tsx`](src/app/(platform)/u/[handle]/page.tsx) is 799 lines with four hardcoded tabs and inline data fetching, and there are ~30 Bluesky API routes exerting steady gravity toward "this is a social network."

## The three pillars

| Pillar | New tables | Depends on |
|---|---|---|
| Board | `profile_blocks`, `creator_themes`, `guestbook_entries`, `featured_friends` | identity cleanup |
| Events | `events`, `event_interests` | board (for the Upcoming block) |
| Subscribers | `subscription_tiers`, `subscriptions` | board (for gated blocks) |

Migrations are drafted:
- [`supabase-migration-profile-blocks.sql`](supabase-migration-profile-blocks.sql)
- [`supabase-migration-events.sql`](supabase-migration-events.sql)
- [`supabase-migration-subscriptions.sql`](supabase-migration-subscriptions.sql)

Board goes first. It is the container the other two display inside, so building it first means events and gated content each ship as "one new block type" instead of each needing their own page.

## Pillar 1 — The board

### Layout model

**Two columns, collapsing to one on mobile.** MySpace was actually a two-column layout — that is what people remember. A free drag-anywhere canvas is roughly 4× the work, cannot be made to work on mobile without a second auto-generated layout, and reliably produces worse-looking pages.

`profile_blocks` stores `column_index` (0 = left, 1 = right) and `position`. The important detail: **`position` orders across both columns, not within one.** That is what makes the mobile collapse coherent — flatten to a single stack sorted by `position` and the reading order is the one the creator intended.

```
Desktop                                  Mobile
┌──────────────┬──────────────┐          ┌──────────────┐
│ ABOUT     p0 │ UPCOMING  p1 │          │ ABOUT     p0 │
├──────────────┼──────────────┤          ├──────────────┤
│ VIDEOS    p2 │ MUSIC     p3 │    →     │ UPCOMING  p1 │
├──────────────┼──────────────┤          ├──────────────┤
│ GALLERY   p4 │ GUESTBK   p5 │          │ VIDEOS    p2 │
└──────────────┴──────────────┘          └──────────────┘
```

Columns are independently variable-height (masonry), so a short block on the left does not force whitespace on the right.

### The block registry

Every block type is self-contained. Adding one should touch exactly one directory plus one line in the DB CHECK constraint.

```
src/lib/blocks/
  registry.ts      -- BlockType -> { view, editor, schema, defaults, icon, label }
  schemas.ts       -- Zod schema per type, validated on write
  types.ts
src/components/blocks/
  about-block.tsx
  upcoming-block.tsx
  gallery-block.tsx
  ...
```

```ts
export const BLOCK_REGISTRY: Record<BlockType, BlockDefinition> = {
  about: {
    label: "About me",
    icon: FiUser,
    schema: aboutBlockSchema,
    defaults: { showPronouns: true, showBasedIn: true },
    view: AboutBlock,
    editor: AboutBlockEditor,
  },
  // ...
};
```

`config` is `jsonb` in the database and the database does not validate its shape. **Every write goes through the type's Zod schema** — that is the only thing standing between a creator and a malformed board. Never render `config` values into markup without escaping; the `embed` and `text` blocks are the two that need real care here.

### Block types

| Type | What it shows | Reads from |
|---|---|---|
| `about` | Bio, photo, pronouns, drag family, based-in | `creators` |
| `upcoming` | Next gigs and streams | `events` |
| `gallery` | Photo grid | `posts` with media |
| `video_showcase` | Pinned videos | `videos` |
| `music` | Audio playlist | `videos` where `content_type='music'` |
| `livestream` | Live now / next stream | `streams` |
| `links` | Outbound links | `config` |
| `text` | Free rich text | `config` |
| `booking` | "Book me" contact, rider, rates | `config` |
| `embed` | YouTube / Bandcamp / Spotify | `config` |
| `featured_friends` | Other creators | `featured_friends` |
| `tip_jar` | USDC tipping | `creators.wallet_address` |
| `guestbook` | Fan wall | `guestbook_entries` |

Two of these carry more weight than their size suggests. **Guestbook** is the thing that makes a board feel alive rather than like a press kit — a profile with twelve messages on it reads completely differently from an empty one. **Featured friends** is the organic growth loop: drag scenes are dense networks of houses, mothers and sisters, and creators pointing at each other is how new artists get discovered. Both are cheap to build and neither is optional if you want the MySpace feeling rather than the Linktree feeling.

### Theming without raw CSS

Raw CSS was MySpace's soul. It is also an XSS vector, a support burden, and the reason half of MySpace was unreadable.

The substitute: `creator_themes` stores a small set of constrained values that map onto the CSS custom properties `globals.css` already declares, scoped to the board root.

```tsx
<div
  className="creator-board"
  style={{
    "--color-dragverse-primary": theme.accent_color,
    "--color-bg-card": derivedCardColor,
    "--board-bg": backgroundValue,
  } as CSSProperties}
>
```

Rules that keep this safe and legible:

- `accent_color` is validated as a hex literal, and rejected if it fails a contrast floor against the chosen background. Creators get a warning and the nearest passing shade, not a broken page.
- `background_value` for `kind='image'` must be a URL on our own Supabase storage domain. No arbitrary remote URLs — that is both an injection surface and a tracking leak.
- `font_pair` selects from a curated set. Never an arbitrary font URL.
- Navigation chrome sits **outside** `.creator-board` and does not inherit theme variables, so no theme can make the site unnavigable.

### Editing

Owner viewing their own board gets an edit mode: add block, reorder (dnd-kit), configure, set per-block visibility, hide. Reordering writes `(column_index, position)` for the affected blocks in one batched call — optimistic locally, persisted on drop.

### API

```
GET    /api/board/[handle]        -- resolved board for a viewer (applies gating)
PATCH  /api/board/blocks/[id]     -- update config / visibility / title
POST   /api/board/blocks          -- add
DELETE /api/board/blocks/[id]
POST   /api/board/reorder         -- batched (column_index, position) writes
PUT    /api/board/theme
```

`GET /api/board/[handle]` runs under the service role and applies gating server-side, the same shape as the existing video access route. The anon-key RLS policy on `profile_blocks` only exposes `visibility = 'public'`, so the failure mode if that route is bypassed is "gated content is invisible" rather than "gated content leaks."

### Migrating the existing profile

[`u/[handle]/page.tsx`](src/app/(platform)/u/[handle]/page.tsx) currently does profile resolution, Bluesky fallback, content loading and rendering in one 799-line client component. The refactor:

1. Extract profile resolution into `src/lib/profile/resolve.ts` — Supabase first, Bluesky fallback, unchanged behaviour.
2. Extract the four tab bodies into `video_showcase`, `gallery`, `music` and `about` blocks.
3. Replace the tab bar with `<CreatorBoard />`.

The migration backfills a default board for every existing creator matching today's layout, so nothing looks empty on rollout. Blocks render nothing when their content set is empty, which makes the backfill safe to apply to all creators indiscriminately.

The Bluesky-handle fallback path is worth keeping deliberately: `/u/[handle]` resolving an unknown Bluesky handle means every drag artist on Bluesky already has a Dragverse landing page you can invite them to claim. That is the best acquisition funnel in the codebase.

## Pillar 2 — Events

### One scheduling primitive

`events` absorbs the three existing mechanisms. Online events **reference** the record that does the work (`stream_id`, `video_id`) rather than duplicating it, so `/live/[handle]` and `/premiere/[id]` keep working unchanged and simply gain an events row alongside.

The payoff is a single list where a Friday club night in Berlin sits next to a Sunday livestream. No other platform does that well for drag artists — Instagram has the flyer but no structure, Bandsintown has the structure but not the scene.

### Details that matter

**Timezones.** Store UTC in `starts_at`, and store the IANA zone the creator entered it in separately. You need both: UTC to sort, the zone to render "10pm local" and to emit valid `.ics`. Deriving one from the other loses information the moment a creator tours.

**Price is free text.** `price_text` is deliberately not numeric. Real door policies are `"£8 adv / £10 door"`, `"donation"`, `"free before 11"`. A `DECIMAL` column would force every creator to lie.

**Lineup is two fields.** `lineup TEXT[]` credits everyone including performers not on the platform; `lineup_dids TEXT[]` links the ones who are. Being tagged in someone's lineup should surface the event on your board too — another growth loop.

### Surfaces

```
/events                      -- discovery, filtered by city and date
/events/[id]                 -- detail, with .ics download and share card
/api/events/ics/[creator]    -- text/calendar feed a fan can subscribe to
```

The `.ics` feed is disproportionately valuable for the cost: a fan subscribes once and every gig the artist adds appears in their phone calendar forever. That is a retention mechanic that requires no notifications infrastructure.

City filtering makes `/events` the answer to "who's performing near me this month," which is the single most useful question this platform can answer and the reason someone who is not already a fan would visit.

## Pillar 3 — Subscribers

### Free first, deliberately

Phase 1 ships free subscribe only. The tables are shaped so paid tiers are an `INSERT` into `subscription_tiers` plus a payment webhook, not a rewrite.

The reasoning: the *mechanic* — a direct, opted-in audience plus a place to put content that is not for the whole internet — is what changes the product, and it costs about a week. The *payment rail* is a separate and much more expensive decision, and which one is right depends on whether your creators turn out to be crypto-native. You will know that in a month of running free subscriptions; you cannot know it now.

When the time comes:

- **Crypto passes** — pay USDC, get 30 days. Reuses the existing tip rails, roughly 3 days of work. Cannot auto-renew, so churn is severe, and it only works for wallet-native fans.
- **Stripe Connect** — real recurring billing. 3–4 weeks plus creator KYC onboarding, webhook reconciliation, and genuine exposure to Stripe's restricted-business rules. Drag itself is fine; anything that reads as adult content is not, and that boundary is enforced unpredictably. Worth understanding before committing.

`subscriptions.provider` and `subscription_tiers.provider` already carry `'none' | 'crypto' | 'stripe'`, so both paths are open without a schema change.

### Gating

`'subscribers'` joins the visibility vocabulary that `posts` already uses (`posts.visibility` already includes `'followers-only'`). Generalise `video-access.ts` into `content-access.ts`:

```ts
export async function resolveAccess(
  content: { visibility: Visibility; creator_did: string },
  viewerDid?: string,
  shareToken?: string,
): Promise<AccessResult>
```

One function, called by the video route, the posts route, the board route and the stream route. **Enforcement lives here, not in RLS**, because resolving `'subscribers'` requires a `subscriptions` lookup under the service role. RLS stays as the safety net: its SELECT policies filter on `visibility = 'public'`, so a bug in the app layer fails closed.

Blocks carry their own `visibility` too, so a creator can put an entire section of their board behind subscription — a subscriber-only gallery, a rehearsal-footage showcase — rather than gating item by item.

### Locked state

A gated block should render as a **teaser, not a void**: the block title, a blurred or count-only preview, and a subscribe button. An invisible block teaches visitors nothing; a locked one converts. This is a product requirement, not a nicety — it is the entire acquisition path for subscriptions.

## What happens to the social features

"Less than a social network" translates concretely to: **keep Bluesky as distribution out, drop it as timeline in.**

Keep — these serve creator reach and identity:

```
/api/bluesky/post, oauth, session, profile, comment, dms, follow, like
```

Demote — these are the aggregated-timeline machinery that makes this feel like a social network:

```
/api/bluesky/feed, list-feed, trending, user-feed, starter-packs, saved-feeds
```

`/feed` stops being a destination in the navbar. It can survive as a "Discover" surface, but the home of the product becomes boards and events.

This is a re-roling, not a deletion. Do not remove the Bluesky profile-fetch path — see the acquisition-funnel note above.

## Identity — already canonical

An earlier draft of this document claimed three overlapping identity systems needed reconciling before anything could be built. That was wrong, and checking it changed the plan.

Identity is already consistent:

- `creators.did` **is** the Privy user id. [`createOrUpdateCreator`](src/lib/supabase/creators.ts) upserts `onConflict: 'did'`, and every caller passes `user.id` / `auth.userId`.
- [`verifyAuth`](src/lib/auth/verify.ts) returns `verifiedClaims.user_id`, which is the same value.
- The Bluesky DID lives in a separate `creators.bluesky_did` column and never collides with it.

So `auth.userId === creators.did` holds throughout, and the profile page comparing `user?.id` against the creator's DID is correct, not a latent bug. The board keys off `creator_did` with no translation layer, and the identity-cleanup phase was dropped.

The one thing this does *not* cover is handle resolution: [`getCreatorByHandleOrDID`](src/lib/supabase/creators.ts) falls back to a case-insensitive `ilike` with `maybeSingle()`, which will throw rather than disambiguate if two creators ever hold handles differing only in case. Pre-existing, unrelated to the board, worth a unique index on `lower(handle)` at some point.

## Sequencing

**Phase 1 — Board. ✅ Built, not yet migrated.** `profile_blocks`, the registry, seven blocks (`about`, `video_showcase`, `gallery`, `music`, `links`, `text`, `booking`), edit mode with reordering, board API, and the profile page wired up. Ships as: profiles look much the same but are now arrangeable. **The migrations have not been run** — the code is inert until `supabase-migration-profile-blocks.sql` is applied.

**Phase 2 — Events and themes.** `events` absorbing scheduled streams and premieres, `upcoming` block, `/events` with city filter, `.ics` export, `creator_themes` with the constrained palette. Ships as: profiles look distinct and answer "where can I see you play."

**Phase 3 — Subscribers.** Free subscribe, `content-access.ts`, `'subscribers'` visibility across content types, gated blocks with teaser states, creator's audience list. Ships as: creators have a reason to post here rather than Instagram.

**Phase 4 — Community.** Guestbook, featured friends, booking block. Demote `/feed`. Ships as: boards feel alive and creators discover each other.

**Later — Paid tiers.** Once you know which rail your creators need.

## Open questions

1. **Photos have no home.** `gallery` reads from `posts` with media, but if the board is the product, photo albums probably deserve a real model of their own rather than being a projection of a social-post table. Worth deciding in Phase 1, because the gallery block's shape depends on it.

2. **Does the guestbook need moderation on day one?** `guestbook_entries.status` supports a pending queue, but defaulting to `'approved'` means a creator can be harassed on their own page before they notice. For a platform serving drag artists specifically, this is not a hypothetical risk. Recommend defaulting new creators to moderated and letting them opt out.

3. **Should events be claimable by venues?** A venue posting a lineup that tags six performers is more valuable than six performers each posting the same night. Out of scope for now, but `events.source` and `lineup_dids` are shaped to allow it later.

4. **How does the board interact with search?** Currently [`search-dropdown.tsx`](src/components/layout/search-dropdown.tsx) searches creators and content. Events should be searchable, and probably rank above content for a query that looks like a city name.
