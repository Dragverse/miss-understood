"use client";

import { useState } from "react";
import { FiDollarSign, FiX } from "react-icons/fi";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { Creator } from "@/types";
import { useWalletClient, usePublicClient, useReadContract } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { base } from "wagmi/chains";
import toast from "react-hot-toast";

interface TipButtonProps {
  creator: Creator;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
}

// USDC contract on Base network
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDC_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
] as const;

export function TipButton({ creator, variant = "primary", size = "md", className = "" }: TipButtonProps) {
  const { user, authenticated, login } = usePrivy();
  const { fundWallet } = useFundWallet();
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState("5");
  const [isSendingTip, setIsSendingTip] = useState(false);

  // Wagmi hooks for Web3 transactions
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = usePublicClient({ chainId: base.id });

  // Get user's wallet address
  const wallet = user?.wallet || user?.linkedAccounts?.find((account: any) => account.type === "wallet");
  const walletAddress = wallet && "address" in wallet ? (wallet.address as `0x${string}`) : undefined;

  // Fetch USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress] : undefined,
    chainId: base.id,
  });

  const handleTipClick = () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!wallet || !("address" in wallet)) {
      toast.error("Please connect a wallet in settings first");
      return;
    }

    setShowTipModal(true);
  };

  const handleSendTip = async () => {
    if (!authenticated || !user) return;

    const amount = parseFloat(tipAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Maximum tip cap of $100
    if (amount > 100) {
      toast.error("Maximum tip amount is $100");
      return;
    }

    setIsSendingTip(true);
    try {
      if (!walletAddress) {
        toast.error("No wallet connected");
        setIsSendingTip(false);
        return;
      }

      // Check if creator has a wallet to receive tips
      if (!creator.walletAddress) {
        toast.error("This creator hasn't set up their wallet yet");
        setIsSendingTip(false);
        return;
      }

      // Convert USD amount to USDC (6 decimals)
      const amountInUsdc = parseUnits(amount.toString(), 6);

      // Check USDC balance
      const balance = usdcBalance as bigint | undefined;
      if (!balance || balance < amountInUsdc) {
        // Insufficient balance - open fund wallet modal
        toast.error("Insufficient USDC balance. Opening funding modal...");
        await fundWallet({
          address: walletAddress,
          options: {
            chain: { id: 8453 },
            asset: "USDC",
            amount: amount.toString(),
          }
        });
        setIsSendingTip(false);
        return;
      }

      if (!walletClient) {
        toast.error("Wallet not ready. Please try again.");
        setIsSendingTip(false);
        return;
      }

      // Show loading toast
      const loadingToast = toast.loading("Sending tip...");

      // Send USDC transaction
      const hash = await walletClient.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [creator.walletAddress as `0x${string}`, amountInUsdc],
        chain: base,
      });

      if (hash) {
        // Wait for confirmation
        await publicClient?.waitForTransactionReceipt({ hash });

        // Record transaction in database
        await fetch("/api/tips/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from: walletAddress,
            to: creator.walletAddress,
            amount: amount,
            amountUSD: amount,
            txHash: hash,
            token: "USDC",
          }),
        });

        toast.dismiss(loadingToast);
        toast.success(`Tip sent successfully! 💰`);
        setShowTipModal(false);
        setTipAmount("5");
      }
    } catch (error: any) {
      console.error("Tip error:", error);
      if (error.message?.includes("User rejected") || error.message?.includes("rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error("Failed to send tip. Please try again.");
      }
    } finally {
      setIsSendingTip(false);
    }
  };

  const buttonSizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  const variantClasses = {
    primary: "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-lg",
    secondary: "bg-[#2f2942] hover:bg-[#3f3952] text-white border border-[#EB83EA]/30",
  };

  return (
    <>
      <button
        onClick={handleTipClick}
        className={`flex items-center gap-2 rounded-full font-semibold transition ${buttonSizeClasses[size]} ${variantClasses[variant]} ${className}`}
        title="Send a tip"
      >
        <FiDollarSign className="w-4 h-4" />
        Tip
      </button>

      {/* Tip Modal */}
      {showTipModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a0b2e] border border-[#EB83EA]/30 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">support {creator.displayName} 💅</h3>
                <p className="text-sm text-gray-400 mt-1">show some love with a tip</p>
              </div>
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setTipAmount("5");
                }}
                className="text-gray-400 hover:text-white transition"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Amount Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-3 text-gray-300">
                Tip Amount (USD) <span className="text-xs text-gray-500">• Max $100</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-400">$</span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-[#0f071a] border-2 border-[#2f2942] focus:border-[#EB83EA] rounded-xl text-2xl font-bold text-white outline-none transition"
                  placeholder="5"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="grid grid-cols-4 gap-2 mt-3">
                {["5", "10", "20", "50"].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setTipAmount(amount)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                      tipAmount === amount ? "bg-[#EB83EA] text-white" : "bg-[#2f2942] text-gray-300 hover:bg-[#3f3952]"
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 mb-6">
              <p className="text-xs text-purple-300">
                Show some love by sending a tip! Your funds are secure with USDC on Base network. 💜
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={handleSendTip}
                disabled={isSendingTip}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#EB83EA] to-purple-600 hover:from-[#E748E6] hover:to-purple-700 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {isSendingTip ? "Processing..." : `Send $${tipAmount} Tip`}
              </button>
              <button
                onClick={() => {
                  setShowTipModal(false);
                  setTipAmount("5");
                }}
                disabled={isSendingTip}
                className="w-full px-6 py-3 bg-[#2f2942] hover:bg-[#3f3952] text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
