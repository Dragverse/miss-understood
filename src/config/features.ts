/**
 * Feature flags.
 *
 * These hide surfaces without deleting them. Everything behind a disabled flag
 * still compiles and still has its components, routes and API endpoints in the
 * tree — flipping the flag back to `true` restores it with no other change.
 */

/**
 * Vertical / short-form video: the /snapshots feed, the ShortVideo player, the
 * snapshots sliders and the shorts sections on home and profiles.
 *
 * Turned off while Dragverse moves away from being a scrolling social product
 * and toward creator-owned boards. The code stays: short videos still upload,
 * still store, and still appear in the creator's own dashboard — they just
 * have no public feed surface.
 *
 * NOTE: this does NOT cover /watch/[id]. That is the long-form horizontal
 * player and remains the destination for every video link on the site.
 */
export const VERTICAL_VIDEO_ENABLED = false;

/**
 * Farcaster and Lens surfaces: profile badges, social links, share targets,
 * and Farcaster's contribution to the watcher count.
 *
 * Off because these are not audiences that help a drag creator — the number
 * flattered the total without representing people who will turn up to a show.
 * Farcaster posting, signers and crossposting are untouched; this only hides
 * the UI and removes it from the metric.
 */
export const FARCASTER_UI_ENABLED = false;

/**
 * Twitch and Instagram as login / account-linking options.
 *
 * MUST stay false until both are toggled ON in the Privy Dashboard under
 * Login Methods. Privy requires config.loginMethods to be a *subset* of what
 * the dashboard enables, and rejects anything else with:
 *
 *   "Invalid Request: Request parameters are invalid: Invalid platform app"
 *
 * That error blocks the whole login modal, not just the offending provider —
 * which is why this defaults off rather than being left on hopefully.
 *
 * Dashboard > your app > Login Methods > enable Twitch and Instagram, then
 * flip this to true. No other change needed.
 *
 * Verified on before enabling, via Privy's own app config endpoint:
 *   GET https://auth.privy.io/api/v1/apps/{appId}
 * which reported twitch_oauth: true and instagram_oauth: true. Re-check there
 * rather than assuming if this ever throws "Invalid platform app" again.
 */
export const SOCIAL_LOGIN_TWITCH_INSTAGRAM = true;
