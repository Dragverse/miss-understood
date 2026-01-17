"use client";

import Link from "next/link";
import { FiUser, FiVideo, FiArrowLeft } from "react-icons/fi";
import { use } from "react";

export default function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        {/* Back Button */}
        <Link
          href="/videos"
          className="inline-flex items-center gap-2 text-[#EB83EA] hover:text-[#E748E6] transition mb-8"
        >
          <FiArrowLeft className="w-5 h-5" />
          Back to Videos
        </Link>

        {/* Icon */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center">
          <FiUser className="w-12 h-12 text-[#EB83EA]" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-[#FCF1FC] mb-4">
          Creator Profile: @{handle}
        </h1>

        {/* Message */}
        <p className="text-gray-400 text-lg mb-6 max-w-2xl mx-auto">
          Individual creator profiles are coming soon! We&apos;re building a comprehensive
          creator discovery system with Bluesky integration.
        </p>

        {/* Info Box */}
        <div className="bg-[#18122D] border border-[#2f2942] rounded-xl p-6 max-w-xl mx-auto mb-8">
          <div className="flex items-start gap-4 text-left">
            <FiVideo className="w-6 h-6 text-[#EB83EA] flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-[#FCF1FC] mb-2">
                In the meantime
              </h3>
              <p className="text-sm text-gray-400">
                Browse all videos from creators on the Videos page, including content
                from the Bluesky drag community. Follow creators and discover amazing
                performances!
              </p>
            </div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/videos"
            className="px-8 py-3 bg-[#EB83EA] text-white rounded-lg font-semibold hover:bg-[#E748E6] transition inline-flex items-center justify-center gap-2"
          >
            <FiVideo className="w-5 h-5" />
            Browse All Videos
          </Link>
          <Link
            href="/"
            className="px-8 py-3 bg-[#18122D] border border-[#2f2942] text-[#FCF1FC] rounded-lg font-semibold hover:bg-[#2f2942] transition"
          >
            Go to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
