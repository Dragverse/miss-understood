"use client";

import Link from "next/link";
import { FiLock, FiCheckCircle } from "react-icons/fi";
import { SiBluesky } from "react-icons/si";

interface ConnectionGateProps {
  hasBluesky: boolean;
  hasFarcaster: boolean;
}

export function ConnectionGate({ hasBluesky, hasFarcaster }: ConnectionGateProps) {
  const hasAnyConnection = hasBluesky || hasFarcaster;

  if (hasAnyConnection) {
    return null;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Lock Icon */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center border-2 border-[#EB83EA]/30">
          <FiLock className="w-12 h-12 text-[#EB83EA]" />
        </div>

        {/* Header */}
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
          Connect to Unlock Feed
        </h1>

        <p className="text-xl text-gray-300 mb-8 leading-relaxed">
          The Feed is available for creators who connect their Bluesky or Farcaster account.
        </p>

        {/* Benefits */}
        <div className="bg-white/5 rounded-2xl p-8 mb-8 border border-white/10">
          <h2 className="text-lg font-bold mb-6">What you'll get:</h2>
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <FiCheckCircle className="w-5 h-5 text-[#EB83EA] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Post text and photos</p>
                <p className="text-sm text-gray-400">Share your thoughts, behind-the-scenes moments, and looks</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FiCheckCircle className="w-5 h-5 text-[#EB83EA] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Engage with the community</p>
                <p className="text-sm text-gray-400">Like, comment, and interact with other creators' posts</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FiCheckCircle className="w-5 h-5 text-[#EB83EA] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Cross-post to Farcaster</p>
                <p className="text-sm text-gray-400">Optionally share your posts across platforms</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FiCheckCircle className="w-5 h-5 text-[#EB83EA] flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Get a verified badge</p>
                <p className="text-sm text-gray-400">Show your connected social accounts on your profile</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/settings?tab=social"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6b2fd5] text-white font-bold rounded-full transition-all shadow-lg hover:shadow-xl"
          >
            <SiBluesky className="w-5 h-5" />
            Connect Bluesky or Farcaster
          </Link>
        </div>

        {/* Note */}
        <p className="text-sm text-gray-500 mt-8">
          We use Bluesky/Farcaster for identity verification and to reduce spam.
          <br />
          Your credentials are securely stored and never shared.
        </p>
      </div>
    </div>
  );
}
