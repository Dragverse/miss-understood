"use client";

import Image from "next/image";
import { FiAlertTriangle } from "react-icons/fi";

export function RightSidebar() {

  return (
    <aside className="hidden lg:block space-y-6 sticky top-6">
      {/* Explore & World Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <a
          href="/explore"
          className="group relative rounded-[24px] overflow-hidden border-2 border-[#34d399]/40 hover:border-[#34d399]/70 transition-all shadow-lg hover:shadow-[#34d399]/20"
        >
          <div className="relative aspect-square">
            <Image
              src="/dragverse.jpg"
              alt="Explore"
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
            <h3 className="font-heading text-lg font-black uppercase tracking-wide text-white">
              Explore
            </h3>
            <svg
              className="w-6 h-6 text-white transform group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </a>

        <a
          href="https://hyperfy.io/dragverse/"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative rounded-[24px] overflow-hidden border-2 border-[#60a5fa]/40 hover:border-[#60a5fa]/70 transition-all shadow-lg hover:shadow-[#60a5fa]/20"
        >
          <div className="relative aspect-square">
            <Image
              src="/dragverse-hall-of-fame.jpg"
              alt="World"
              fill
              className="object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between">
            <h3 className="font-heading text-lg font-black uppercase tracking-wide text-white">
              World
            </h3>
            <svg
              className="w-6 h-6 text-white transform group-hover:translate-x-1 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </div>
        </a>
      </div>

      {/* Platform Status - Beta Warning */}
      <div className="relative p-6 rounded-[24px] bg-gradient-to-br from-purple-600/20 via-purple-700/15 to-purple-900/20 border-2 border-purple-500/40 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,0.15),transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-full bg-purple-500/20">
              <FiAlertTriangle className="w-5 h-5 text-yellow-300" />
            </div>
            <span className="font-heading text-xl font-black text-white uppercase tracking-wider">
              Beta Warning
            </span>
          </div>
          <p className="text-sm text-purple-100 leading-relaxed">
            Dragverse is in active development. Please be aware some features might not be working correctly.
          </p>
        </div>
      </div>

      {/* Sponsored Section */}
      <div className="rounded-[24px] overflow-hidden border-2 border-[#2f2942]/60 hover:border-[#2f2942] transition-all group shadow-lg">
        <a
          href="https://salti.printful.me/product/salti-25-premium-sherpa-blanket"
          target="_blank"
          rel="noopener noreferrer"
          className="block relative"
        >
          {/* Sponsored Label - Absolute positioned over image */}
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full border border-white/10">
            <span className="text-[10px] text-gray-300 uppercase tracking-[0.15em] font-bold">
              Sponsored
            </span>
          </div>

          <div className="relative aspect-square overflow-hidden bg-[#0f071a]">
            <Image
              src="/salti-blanket.webp"
              alt="Salti Premium Sherpa Blanket"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        </a>
      </div>
    </aside>
  );
}
