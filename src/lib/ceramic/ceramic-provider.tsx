"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { DID } from "dids";
import { authenticateWithCeramic, authenticateWithSeed, getCeramicClient, getCurrentDID, isAuthenticated } from "./client";
import { useAutoProfileCreation } from "./hooks/use-auto-profile";
import toast from "react-hot-toast";

interface CeramicContextType {
  ceramicDID: string | null;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  authenticateCeramic: () => Promise<void>;
  error: string | null;
}

const CeramicContext = createContext<CeramicContextType>({
  ceramicDID: null,
  isAuthenticated: false,
  isAuthenticating: false,
  authenticateCeramic: async () => {},
  error: null,
});

export function useCeramic() {
  const context = useContext(CeramicContext);
  if (!context) {
    throw new Error("useCeramic must be used within CeramicProvider");
  }
  return context;
}

interface CeramicProviderProps {
  children: ReactNode;
}

export function CeramicProvider({ children }: CeramicProviderProps) {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [ceramicDID, setCeramicDID] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-create profile on first login
  useAutoProfileCreation();

  // Auto-authenticate when user signs in
  useEffect(() => {
    if (authenticated && !ceramicDID && !isAuthenticating) {
      authenticateCeramicSession();
    }
  }, [authenticated, ceramicDID, isAuthenticating]);

  const authenticateCeramicSession = async () => {
    if (isAuthenticating) return;

    setIsAuthenticating(true);
    setError(null);

    try {
      let did: DID;

      // Try wallet-based authentication first if user has a wallet
      const primaryWallet = wallets.find(w => w.walletClientType === "metamask" || w.walletClientType === "coinbase_wallet");

      if (primaryWallet) {
        try {
          const provider = await primaryWallet.getEthereumProvider();
          did = await authenticateWithCeramic(provider);
          console.log("✅ Ceramic authenticated with wallet:", did.id);
        } catch (walletError) {
          console.warn("Wallet authentication failed, falling back to seed auth:", walletError);
          // Fallback to seed-based auth
          did = await authenticateWithSeed();
          console.log("✅ Ceramic authenticated with seed:", did.id);
        }
      } else {
        // No wallet available, use seed-based auth
        // In production, you might want to derive the seed from user ID for consistency
        const userSeed = user?.id ? generateDeterministicSeed(user.id) : undefined;
        did = await authenticateWithSeed(userSeed);
        console.log("✅ Ceramic authenticated with seed:", did.id);
      }

      setCeramicDID(did.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to authenticate with Ceramic";
      console.error("Ceramic authentication error:", err);
      setError(errorMessage);
      toast.error("Failed to authenticate with Ceramic Network");
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Generate a deterministic seed from user ID for consistent DID across sessions
  const generateDeterministicSeed = (userId: string): string => {
    // Simple hash function to generate hex seed from user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Generate 64-character hex string (32 bytes)
    const seed = Array(16)
      .fill(0)
      .map((_, i) => {
        const chunk = (hash * (i + 1)).toString(16).padStart(4, '0');
        return chunk.slice(0, 4);
      })
      .join('');

    return seed;
  };

  return (
    <CeramicContext.Provider
      value={{
        ceramicDID: ceramicDID || getCurrentDID(),
        isAuthenticated: isAuthenticated(),
        isAuthenticating,
        authenticateCeramic: authenticateCeramicSession,
        error,
      }}
    >
      {children}
    </CeramicContext.Provider>
  );
}
