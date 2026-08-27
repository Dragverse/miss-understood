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
