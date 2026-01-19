"use client";

import { useState } from "react";
import { FiX, FiCopy, FiCheck, FiClock, FiEye, FiTwitter, FiFacebook } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { SiBluesky, SiThreads } from "react-icons/si";
import toast from "react-hot-toast";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
  videoVisibility: "public" | "unlisted" | "private";
  isOwner: boolean;
}

export function ShareModal({
  isOpen,
  onClose,
  videoId,
  videoTitle,
  videoVisibility,
  isOwner,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [expiresIn, setExpiresIn] = useState<number>(3600); // 1 hour default
  const [maxViews, setMaxViews] = useState<number | undefined>(undefined);

  if (!isOpen) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const directLink = `${baseUrl}/watch/${videoId}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const generateShareToken = async () => {
    if (!isOwner) {
      toast.error("Only the video owner can generate share links");
      return;
    }

    setGeneratingToken(true);
    try {
      const response = await fetch("/api/video/share/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          expiresIn,
          maxViews,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate share link");
      }

      const data = await response.json();
      setShareUrl(data.shareUrl);
      toast.success("Share link generated!");
    } catch (error) {
      console.error("Error generating share link:", error);
      toast.error("Failed to generate share link");
    } finally {
      setGeneratingToken(false);
    }
  };

  const shareToSocial = (platform: "twitter" | "facebook" | "whatsapp" | "threads" | "bluesky" | "farcaster") => {
    const encodedUrl = encodeURIComponent(directLink);
    const encodedTitle = encodeURIComponent(videoTitle);

    let shareLink = "";
    switch (platform) {
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
        break;
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case "whatsapp":
        shareLink = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
        break;
      case "threads":
        // Threads sharing (opens Threads app or web with share intent)
        shareLink = `https://www.threads.net/intent/post?text=${encodedTitle}%20${encodedUrl}`;
        break;
      case "bluesky":
        // Bluesky sharing (compose post with text)
        shareLink = `https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}`;
        break;
      case "farcaster":
        // Farcaster sharing via Warpcast
        shareLink = `https://warpcast.com/~/compose?text=${encodedTitle}&embeds[]=${encodedUrl}`;
        break;
    }

    window.open(shareLink, "_blank", "width=600,height=400");
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a0b2e] rounded-2xl max-w-md w-full p-6 border border-[#2f2942]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Share Video</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Direct Link */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            Direct Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={directLink}
              readOnly
              className="flex-1 px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl text-sm"
            />
            <button
              onClick={() => copyToClipboard(directLink)}
              className="px-4 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-xl transition flex items-center gap-2"
            >
              {copied ? <FiCheck className="w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {videoVisibility === "public" && "Anyone can search for and view this video"}
            {videoVisibility === "unlisted" && "Only people with this link can view"}
            {videoVisibility === "private" && "Only you can view (generate a share link below)"}
          </p>
        </div>

        {/* Temporary Share Link (for private/unlisted videos) */}
        {isOwner && videoVisibility !== "public" && (
          <div className="mb-6 p-4 bg-[#0f071a] rounded-xl border border-[#2f2942]">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FiClock className="w-4 h-4" />
              Generate Temporary Share Link
            </h3>

            <div className="space-y-3 mb-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Expires In
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#1a0b2e] border border-[#2f2942] rounded-lg text-sm"
                >
                  <option value={3600}>1 hour</option>
                  <option value={21600}>6 hours</option>
                  <option value={86400}>24 hours</option>
                  <option value={604800}>7 days</option>
                  <option value={2592000}>30 days</option>
                  <option value={0}>Never</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Max Views (Optional)
                </label>
                <input
                  type="number"
                  value={maxViews || ""}
                  onChange={(e) => setMaxViews(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Unlimited"
                  min="1"
                  className="w-full px-3 py-2 bg-[#1a0b2e] border border-[#2f2942] rounded-lg text-sm"
                />
              </div>
            </div>

            <button
              onClick={generateShareToken}
              disabled={generatingToken}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition text-sm"
            >
              {generatingToken ? "Generating..." : "Generate Link"}
            </button>

            {shareUrl && (
              <div className="mt-3 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                <div className="flex gap-2 items-center mb-1">
                  <FiCheck className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-green-400 font-semibold">Link Generated</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-2 py-1 bg-[#0f071a] border border-[#2f2942] rounded text-xs"
                  />
                  <button
                    onClick={() => copyToClipboard(shareUrl)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Social Sharing (only for public videos) */}
        {videoVisibility === "public" && (
          <div>
            <label className="block text-sm font-semibold mb-3 text-gray-300">
              Share to Social Media
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => shareToSocial("threads")}
                className="flex flex-col items-center gap-2 p-4 bg-[#0f071a] hover:bg-white/10 border border-[#2f2942] hover:border-white/50 rounded-xl transition"
              >
                <SiThreads className="w-6 h-6 text-white" />
                <span className="text-xs">Threads</span>
              </button>
              <button
                onClick={() => shareToSocial("bluesky")}
                className="flex flex-col items-center gap-2 p-4 bg-[#0f071a] hover:bg-[#0085FF]/10 border border-[#2f2942] hover:border-[#0085FF]/50 rounded-xl transition"
              >
                <SiBluesky className="w-6 h-6 text-[#0085FF]" />
                <span className="text-xs">Bluesky</span>
              </button>
              <button
                onClick={() => shareToSocial("farcaster")}
                className="flex flex-col items-center gap-2 p-4 bg-[#0f071a] hover:bg-[#8465CB]/10 border border-[#2f2942] hover:border-[#8465CB]/50 rounded-xl transition"
              >
                <svg className="w-6 h-6 text-[#8465CB]" viewBox="0 0 1000 1000" fill="currentColor">
                  <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z"/>
                  <path d="M128.889 253.333L0 382.222V1000H155.556V462.778L184.444 433.889H219.444V382.222H128.889V253.333Z"/>
                  <path d="M871.111 253.333L1000 382.222V1000H844.444V462.778L815.556 433.889H780.556V382.222H871.111V253.333Z"/>
                </svg>
                <span className="text-xs">Farcaster</span>
              </button>
              <button
                onClick={() => shareToSocial("twitter")}
                className="flex flex-col items-center gap-2 p-4 bg-[#0f071a] hover:bg-[#1DA1F2]/10 border border-[#2f2942] hover:border-[#1DA1F2]/50 rounded-xl transition"
              >
                <FiTwitter className="w-6 h-6 text-[#1DA1F2]" />
                <span className="text-xs">Twitter</span>
              </button>
              <button
                onClick={() => shareToSocial("facebook")}
                className="flex flex-col items-center gap-2 p-4 bg-[#0f071a] hover:bg-[#4267B2]/10 border border-[#2f2942] hover:border-[#4267B2]/50 rounded-xl transition"
              >
                <FiFacebook className="w-6 h-6 text-[#4267B2]" />
                <span className="text-xs">Facebook</span>
              </button>
              <button
                onClick={() => shareToSocial("whatsapp")}
                className="flex flex-col items-center gap-2 p-4 bg-[#0f071a] hover:bg-[#25D366]/10 border border-[#2f2942] hover:border-[#25D366]/50 rounded-xl transition"
              >
                <FaWhatsapp className="w-6 h-6 text-[#25D366]" />
                <span className="text-xs">WhatsApp</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
