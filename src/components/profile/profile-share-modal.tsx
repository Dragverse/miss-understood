"use client";

import { useState } from "react";
import { FiX, FiCopy, FiCheck, FiTwitter, FiFacebook } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { SiBluesky, SiThreads } from "react-icons/si";
import toast from "react-hot-toast";
import { FarcasterIcon } from "@/components/profile/farcaster-badge";

interface ProfileShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileUrl: string;
  displayName: string;
  handle: string;
}

function LensIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 2.69 3 6s-1.34 6-3 6-3-2.69-3-6 1.34-6 3-6zm-7 6c0-1.66 2.69-3 6-3v1c-2.76 0-5 .9-5 2s2.24 2 5 2v1c-3.31 0-6-1.34-6-3zm14 0c0 1.66-2.69 3-6 3v-1c2.76 0 5-.9 5-2s-2.24-2-5-2V8c3.31 0 6 1.34 6 3z" />
    </svg>
  );
}

export function ProfileShareModal({
  isOpen,
  onClose,
  profileUrl,
  displayName,
  handle,
}: ProfileShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareText = `Check out @${handle} on Dragverse`;
  const encodedUrl = encodeURIComponent(profileUrl);
  const encodedText = encodeURIComponent(shareText);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareToSocial = (platform: string) => {
    let shareLink = "";
    switch (platform) {
      case "twitter":
        shareLink = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
        break;
      case "bluesky":
        shareLink = `https://bsky.app/intent/compose?text=${encodedText}%20${encodedUrl}`;
        break;
      case "farcaster":
        shareLink = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedUrl}`;
        break;
      case "lens":
        shareLink = `https://hey.xyz/?text=${encodedText}%20${encodedUrl}`;
        break;
      case "threads":
        shareLink = `https://www.threads.net/intent/post?text=${encodedText}%20${encodedUrl}`;
        break;
      case "facebook":
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case "whatsapp":
        shareLink = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;
        break;
    }
    window.open(shareLink, "_blank", "width=600,height=400");
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1a0b2e] rounded-2xl max-w-md w-full p-6 border border-[#2f2942]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Share Profile</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Copy Link */}
        <div className="mb-6">
          <label className="block text-sm font-semibold mb-2 text-gray-300">
            Profile Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={profileUrl}
              readOnly
              className="flex-1 px-4 py-3 bg-[#0f071a] border border-[#2f2942] rounded-xl text-sm"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-3 bg-[#EB83EA] hover:bg-[#E748E6] rounded-xl transition flex items-center gap-2"
            >
              {copied ? <FiCheck className="w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Social Sharing */}
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
              <FarcasterIcon className="w-6 h-6" />
              <span className="text-xs">Farcaster</span>
            </button>
            <button
              onClick={() => shareToSocial("lens")}
              className="flex flex-col items-center gap-2 p-4 bg-[#0f071a] hover:bg-[#00501E]/10 border border-[#2f2942] hover:border-[#00501E]/50 rounded-xl transition"
            >
              <LensIcon className="w-6 h-6 text-[#6BC674]" />
              <span className="text-xs">Lens</span>
            </button>
            <button
              onClick={() => shareToSocial("twitter")}
              className="flex flex-col items-center gap-2 p-4 bg-[#0f071a] hover:bg-[#1DA1F2]/10 border border-[#2f2942] hover:border-[#1DA1F2]/50 rounded-xl transition"
            >
              <FiTwitter className="w-6 h-6 text-[#1DA1F2]" />
              <span className="text-xs">Twitter</span>
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
      </div>
    </div>
  );
}
