/**
 * Bluesky AT Protocol OAuth Client
 *
 * Confidential OAuth client for Bluesky authentication.
 * Uses Supabase for persistent state/session storage.
 * Sessions last up to 2 years (confidential client).
 */

import {
  NodeOAuthClient,
  JoseKey,
  requestLocalLock,
} from "@atproto/oauth-client-node";
import type {
  NodeSavedState,
  NodeSavedSession,
  NodeSavedStateStore,
  NodeSavedSessionStore,
} from "@atproto/oauth-client-node";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Agent } from "@atproto/api";

// ─── Supabase-backed stores ─────────────────────────────────

function getServiceSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function createStateStore(): NodeSavedStateStore {
  const supabase = getServiceSupabase();

  return {
    async set(key: string, state: NodeSavedState) {
      await supabase
        .from("bluesky_oauth_state")
        .upsert({ key, state, created_at: new Date().toISOString() });
    },
    async get(key: string) {
      const { data } = await supabase
        .from("bluesky_oauth_state")
        .select("state")
        .eq("key", key)
        .single();
      return data?.state as NodeSavedState | undefined;
    },
    async del(key: string) {
      await supabase.from("bluesky_oauth_state").delete().eq("key", key);
    },
  };
}

function createSessionStore(): NodeSavedSessionStore {
  const supabase = getServiceSupabase();

  return {
    async set(sub: string, session: NodeSavedSession) {
      await supabase.from("bluesky_oauth_session").upsert({
        key: sub,
        session,
        updated_at: new Date().toISOString(),
      });
    },
    async get(sub: string) {
      const { data } = await supabase
        .from("bluesky_oauth_session")
        .select("session")
        .eq("key", sub)
        .single();
      return data?.session as NodeSavedSession | undefined;
    },
    async del(sub: string) {
      await supabase.from("bluesky_oauth_session").delete().eq("key", sub);
    },
  };
}

// ─── OAuth Client ────────────────────────────────────────────

let _client: NodeOAuthClient | null = null;

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

export async function getOAuthClient(): Promise<NodeOAuthClient> {
  if (_client) return _client;

  const appUrl = getAppUrl();
  const privateKeyJwk = JSON.parse(process.env.BLUESKY_OAUTH_PRIVATE_KEY!);

  const keyset = [await JoseKey.fromJWK(privateKeyJwk)];

  _client = new NodeOAuthClient({
    clientMetadata: {
      client_id: `${appUrl}/api/bluesky/oauth/client-metadata.json`,
      client_name: "Dragverse",
      client_uri: appUrl,
      redirect_uris: [`${appUrl}/api/bluesky/oauth/callback`],
      grant_types: ["authorization_code", "refresh_token"],
      scope: "atproto transition:generic",
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_signing_alg: "ES256",
      dpop_bound_access_tokens: true,
      jwks_uri: `${appUrl}/api/bluesky/oauth/jwks.json`,
    },
    keyset,
    stateStore: createStateStore(),
    sessionStore: createSessionStore(),
    requestLock: requestLocalLock,
  });

  return _client;
}

/**
 * Get an authenticated AT Protocol Agent from an OAuth session.
 * Returns null if session is expired/revoked.
 */
export async function getOAuthAgent(did: string): Promise<Agent | null> {
  try {
    const client = await getOAuthClient();
    const session = await client.restore(did);

    const agent = new Agent(session);
    return agent;
  } catch (error) {
    console.error("[Bluesky OAuth] Failed to restore session for", did, error);
    return null;
  }
}

/**
 * Store the mapping between Privy user DID and Bluesky OAuth DID
 */
export async function linkBlueskyOAuthDID(
  privyDID: string,
  blueskyDID: string,
  blueskyHandle: string
): Promise<void> {
  const supabase = getServiceSupabase();
  await supabase
    .from("creators")
    .update({
      bluesky_oauth_did: blueskyDID,
      bluesky_handle: blueskyHandle,
      bluesky_did: blueskyDID,
      updated_at: new Date().toISOString(),
    })
    .eq("did", privyDID);
}

/**
 * Get the Bluesky OAuth DID for a Privy user
 */
export async function getBlueskyOAuthDID(
  privyDID: string
): Promise<string | null> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("creators")
    .select("bluesky_oauth_did")
    .eq("did", privyDID)
    .single();
  return data?.bluesky_oauth_did || null;
}

/**
 * Clear Bluesky OAuth connection for a user
 */
export async function clearBlueskyOAuth(privyDID: string): Promise<void> {
  const supabase = getServiceSupabase();

  // Get the Bluesky DID to clean up the session
  const { data } = await supabase
    .from("creators")
    .select("bluesky_oauth_did")
    .eq("did", privyDID)
    .single();

  if (data?.bluesky_oauth_did) {
    // Revoke the OAuth session
    try {
      const client = await getOAuthClient();
      await client.revoke(data.bluesky_oauth_did);
    } catch (error) {
      console.error("[Bluesky OAuth] Failed to revoke session:", error);
    }

    // Clean up session store
    await supabase
      .from("bluesky_oauth_session")
      .delete()
      .eq("key", data.bluesky_oauth_did);
  }

  // Clear from creators table
  await supabase
    .from("creators")
    .update({
      bluesky_oauth_did: null,
      bluesky_handle: null,
      bluesky_did: null,
      bluesky_app_password: null,
      updated_at: new Date().toISOString(),
    })
    .eq("did", privyDID);
}
