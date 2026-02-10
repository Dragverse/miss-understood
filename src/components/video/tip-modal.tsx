"use client";

import { useState } from "react";
import { FiX, FiDollarSign, FiCheck } from "react-icons/fi";
import { SiEthereum } from "react-icons/si";
import toast from "react-hot-toast";
import { usePrivy, useFundWallet } from "@privy-io/react-auth";
import { useWalletClient, usePublicClient, useReadContract } from "wagmi";
import { parseUnits, parseEther } from "viem";
import { base } from "wagmi/chains";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorName: string;
  creatorDID: string;
  creatorWallet?: string;
  videoId?: string;
}

type PaymentMethod = "crypto" | "card";
type CryptoCurrency = "ETH" | "USDC";

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

export function TipModal({
  isOpen,
  onClose,
  creatorName,
  creatorDID,
  creatorWallet,
  videoId,
}: TipModalProps) {
  const { user, authenticated, login } = usePrivy();
  const { fundWallet } = useFundWallet();
  const { data: walletClient } = useWalletClient({ chainId: base.id });
  const publicClient = usePublicClient({ chainId: base.id });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("crypto");
  const [cryptoCurrency, setCryptoCurrency] = useState<CryptoCurrency>("USDC");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [tipSent, setTipSent] = useState(false);

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

  const presetAmounts = paymentMethod === "crypto"
    ? cryptoCurrency === "USDC"
      ? ["5", "10", "25", "50"]
      : ["0.001", "0.005", "0.01", "0.05"]
    : ["5", "10", "25", "50"];

  const handleTipSubmit = async () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    // Validate wallet connection
    if (!wallet || !("address" in wallet)) {
      toast.error("Please connect a wallet in settings first");
      return;
    }

    try {
      setProcessing(true);

      if (paymentMethod === "crypto") {
        await handleCryptoTip();
      } else {
        await handleStripeTip();
      }

      setTipSent(true);
      toast.success(`Tip sent to ${creatorName}!`);

      // Reset and close after showing success
      setTimeout(() => {
        setTipSent(false);
        setAmount("");
        setMessage("");
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error("Tip error:", error);
      if (error.message?.includes("User rejected") || error.message?.includes("rejected")) {
        toast.error("Transaction cancelled");
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to send tip");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleCryptoTip = async () => {
    if (!authenticated || !user || !walletAddress) {
      throw new Error("Please sign in and connect your wallet");
    }

    // Check if creator has a wallet to receive tips
    if (!creatorWallet) {
      throw new Error("This creator hasn't set up their wallet yet");
    }

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      throw new Error("Please enter a valid amount");
    }

    // Maximum tip cap of $100 for USDC, 0.1 ETH for ETH
    const maxAmount = cryptoCurrency === "USDC" ? 100 : 0.1;
    if (amountValue > maxAmount) {
      throw new Error(`Maximum tip amount is ${maxAmount} ${cryptoCurrency}`);
    }

    if (!walletClient) {
      throw new Error("Wallet not ready. Please try again.");
    }

    let txHash: string;
    const loadingToast = toast.loading("Sending tip...");

    try {
      if (cryptoCurrency === "USDC") {
        // Send USDC transaction
        const amountInUsdc = parseUnits(amountValue.toString(), 6);

        // Check USDC balance
        const balance = usdcBalance as bigint | undefined;
        if (!balance || balance < amountInUsdc) {
          toast.dismiss(loadingToast);
          toast.error("Insufficient USDC balance. Opening funding modal...");
          await fundWallet({
            address: walletAddress,
            options: {
              chain: { id: 8453 },
              asset: "USDC",
              amount: amountValue.toString(),
            }
          });
          throw new Error("Please fund your wallet and try again");
        }

        txHash = await walletClient.writeContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "transfer",
          args: [creatorWallet as `0x${string}`, amountInUsdc],
          chain: base,
        });
      } else {
        // Send ETH transaction
        const amountInWei = parseEther(amountValue.toString());

        txHash = await walletClient.sendTransaction({
          to: creatorWallet as `0x${string}`,
          value: amountInWei,
          chain: base,
        });
      }

      // Wait for confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
      }

      // Record transaction in database
      const recordResponse = await fetch("/api/tips/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: walletAddress,
          to: creatorWallet,
          amount: amountValue,
          amountUSD: amountValue, // For USDC 1:1, for ETH this should be converted
          txHash,
          token: cryptoCurrency,
        }),
      });

      if (!recordResponse.ok) {
        console.warn("Failed to record tip in database:", await recordResponse.text());
        // Don't throw - tip was sent successfully, just logging failed
      }

      toast.dismiss(loadingToast);
      console.log(`✅ Sent ${amount} ${cryptoCurrency} to ${creatorName} - tx: ${txHash}`);
    } catch (error) {
      toast.dismiss(loadingToast);
      throw error;
    }
  };

  const handleStripeTip = async () => {
    // TODO: Implement Stripe payment integration
    // For now, show placeholder message

    // Example future implementation:
    // const response = await fetch("/api/tips/stripe", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     toDID: creatorDID,
    //     amount: parseFloat(amount),
    //     videoId,
    //     message,
    //   }),
    // });
    // const { clientSecret } = await response.json();
    //
    // // Use Stripe Elements to complete payment
    // const { error } = await stripe.confirmPayment({
    //   clientSecret,
    //   confirmParams: { return_url: window.location.href },
    // });

    console.log(`Processing $${amount} Stripe payment to ${creatorName}`);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast("Stripe integration coming in Phase 7B!");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="relative w-full max-w-md bg-[#1a0b2e] border border-[#2f2942] rounded-[24px] p-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition"
        >
          <FiX className="w-5 h-5" />
        </button>

        {tipSent ? (
          // Success State
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
              <FiCheck className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Tip Sent!</h2>
            <p className="text-gray-400">
              {creatorName} will receive your {amount} {paymentMethod === "crypto" ? cryptoCurrency : "USD"} tip
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Tip {creatorName}</h2>
              <p className="text-gray-400 text-sm">
                Show your support for their amazing content
              </p>
            </div>

            {/* Payment Method Toggle */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setPaymentMethod("crypto")}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  paymentMethod === "crypto"
                    ? "border-[#EB83EA] bg-[#EB83EA]/10"
                    : "border-[#2f2942] hover:border-[#EB83EA]/50"
                }`}
              >
                <SiEthereum className={`w-6 h-6 ${paymentMethod === "crypto" ? "text-[#EB83EA]" : "text-gray-400"}`} />
                <span className="font-semibold text-sm">Crypto</span>
              </button>
              <button
                onClick={() => setPaymentMethod("card")}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  paymentMethod === "card"
                    ? "border-[#EB83EA] bg-[#EB83EA]/10"
                    : "border-[#2f2942] hover:border-[#EB83EA]/50"
                }`}
              >
                <FiDollarSign className={`w-6 h-6 ${paymentMethod === "card" ? "text-[#EB83EA]" : "text-gray-400"}`} />
                <span className="font-semibold text-sm">Card</span>
              </button>
            </div>

            {/* Crypto Currency Selection */}
            {paymentMethod === "crypto" && (
              <div className="mb-6">
                <label className="block text-sm font-semibold mb-2 text-gray-300">
                  Currency
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCryptoCurrency("ETH")}
                    className={`px-4 py-2 rounded-lg border transition ${
                      cryptoCurrency === "ETH"
                        ? "border-[#EB83EA] bg-[#EB83EA]/10 text-white"
                        : "border-[#2f2942] text-gray-400 hover:border-[#EB83EA]/50"
                    }`}
                  >
                    ETH
                  </button>
                  <button
                    onClick={() => setCryptoCurrency("USDC")}
                    className={`px-4 py-2 rounded-lg border transition ${
                      cryptoCurrency === "USDC"
                        ? "border-[#EB83EA] bg-[#EB83EA]/10 text-white"
                        : "border-[#2f2942] text-gray-400 hover:border-[#EB83EA]/50"
                    }`}
                  >
                    USDC
                  </button>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Amount {paymentMethod === "crypto" ? `(${cryptoCurrency})` : "(USD)"}
              </label>
              <input
                type="number"
                step={paymentMethod === "crypto" ? "0.001" : "1"}
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={paymentMethod === "crypto" ? "0.001" : "5.00"}
                className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition text-lg"
              />
            </div>

            {/* Preset Amounts */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {presetAmounts.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset)}
                  className="px-3 py-2 bg-[#0f071a] border border-[#2f2942] hover:border-[#EB83EA] rounded-lg text-sm font-semibold transition"
                >
                  {paymentMethod === "crypto" ? preset : `$${preset}`}
                </button>
              ))}
            </div>

            {/* Optional Message */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2 text-gray-300">
                Message (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Leave a kind message..."
                maxLength={200}
                rows={3}
                className="w-full px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl focus:outline-none focus:border-[#EB83EA] transition resize-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-1 text-right">
                {message.length}/200
              </p>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleTipSubmit}
              disabled={processing || !amount}
              className="w-full px-6 py-4 bg-[#EB83EA] hover:bg-[#E748E6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-full transition-colors flex items-center justify-center gap-2"
            >
              {processing ? (
                "Processing..."
              ) : (
                <>
                  <FiDollarSign className="w-5 h-5" />
                  Send Tip
                </>
              )}
            </button>

            {/* Wallet Status & Info Text */}
            {paymentMethod === "crypto" && (
              <div className="mt-4 space-y-2">
                {!authenticated ? (
                  <p className="text-xs text-yellow-400 text-center">
                    ⚠️ Please sign in to send tips
                  </p>
                ) : !walletAddress ? (
                  <p className="text-xs text-yellow-400 text-center">
                    ⚠️ Please connect a wallet in settings to send tips
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 text-center">
                      Tips are sent directly to the creator's wallet on Base Network
                    </p>
                    {cryptoCurrency === "USDC" && usdcBalance !== undefined && (
                      <p className="text-xs text-gray-400 text-center">
                        Your USDC balance: ${(Number(usdcBalance) / 1e6).toFixed(2)}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            {paymentMethod === "card" && (
              <p className="text-xs text-gray-500 text-center mt-4">
                Secure payment processing by Stripe
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
