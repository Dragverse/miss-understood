"use client";

import React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "@privy-io/wagmi";
import { config } from "@/lib/privy/config";
import { base, mainnet, optimism } from "wagmi/chains";
import { AudioPlayerProvider } from "@/contexts/AudioPlayerContext";
import { HuddleProvider } from "@/contexts/HuddleProvider";
import { TWITCH_LOGIN_ENABLED, INSTAGRAM_LOGIN_ENABLED } from "@/config/features";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!privyAppId) {
    console.error("NEXT_PUBLIC_PRIVY_APP_ID is not set");
  }

  return (
    <PrivyProvider
      appId={privyAppId || ""}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#EB83EA",
          logo: undefined,
          landingHeader: "Welcome to Dragverse",
          loginMessage: "Sign in to upload, like, and comment on drag content",
          walletList: ["metamask", "coinbase_wallet", "wallet_connect"],
        },
        // Login methods, in the order they appear.
        //
        // Wallet is off: it was a barrier for drag creators who have no reason
        // to hold one, and tipping still works because Privy provisions an
        // embedded wallet on demand. Farcaster is off alongside the rest of
        // the Farcaster UI (see FARCASTER_UI_ENABLED).
        //
        // Twitch and Instagram are here because that's who these creators
        // already are — and connecting Twitch also gives us the username the
        // Helix API needs for follower counts.
        loginMethods: [
          "email",
          "google",
          ...(TWITCH_LOGIN_ENABLED ? (["twitch"] as const) : []),
          ...(INSTAGRAM_LOGIN_ENABLED ? (["instagram"] as const) : []),
        ],
        // Required, not incidental: createOnLogin defaults to 'off', so with
        // wallet login removed a new user would have no wallet at all and
        // tipping would silently stop working for them — tip-modal.tsx bails
        // without a wallet address. An embedded wallet keeps tipping alive
        // without asking a drag creator to understand self-custody.
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        // Supported chains for wallet connections
        supportedChains: [base, mainnet, optimism],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <HuddleProvider>
          <AudioPlayerProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              {children}
              <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#18122D",
                  color: "#FCF1FC",
                  border: "1px solid #2f2942",
                },
                // Default duration for all toasts
                duration: 5000,
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: "#EB83EA",
                    secondary: "#FCF1FC",
                  },
                },
                error: {
                  duration: 8000, // Errors stay longer (8 seconds)
                  style: {
                    background: "#18122D",
                    color: "#FCF1FC",
                    border: "2px solid #EF4444",
                  },
                  iconTheme: {
                    primary: "#EF4444",
                    secondary: "#FCF1FC",
                  },
                },
                loading: {
                  duration: Infinity, // Loading toasts stay until dismissed
                  style: {
                    background: "#18122D",
                    color: "#FCF1FC",
                    border: "1px solid #EB83EA",
                  },
                  iconTheme: {
                    primary: "#EB83EA",
                    secondary: "#FCF1FC",
                  },
                },
              }}
            />
            </ThemeProvider>
          </AudioPlayerProvider>
          </HuddleProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
