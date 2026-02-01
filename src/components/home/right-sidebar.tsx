"use client";

import Image from "next/image";
import {
  FiAlertTriangle,
  FiAward,
  FiGlobe,
  FiCompass,
} from "react-icons/fi";

export function RightSidebar() {

  return (
    <aside className="hidden lg:block space-y-6 sticky top-6">
      {/* Explore & World Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <a
          href="/explore"
          className="group relative p-6 rounded-[24px] bg-gradient-to-br from-[#34d399]/20 to-[#10b981]/20 border border-[#34d399]/30 hover:border-[#34d399]/60 transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#34d399]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center justify-center h-full">
            <FiCompass className="w-8 h-8 text-[#34d399] mb-2" />
            <h3 className="font-bold text-sm uppercase tracking-wide text-white">Explore</h3>
          </div>
        </a>

        <a
          href="https://hyperfy.io/dragverse/"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative p-6 rounded-[24px] bg-gradient-to-br from-[#60a5fa]/20 to-[#3b82f6]/20 border border-[#60a5fa]/30 hover:border-[#60a5fa]/60 transition-all overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#60a5fa]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center justify-center h-full">
            <FiGlobe className="w-8 h-8 text-[#60a5fa] mb-2" />
            <h3 className="font-bold text-sm uppercase tracking-wide text-white">World</h3>
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

      {/* Dragverse Hall of Fame */}
      <a
        href="https://world.dragverse.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-[24px] overflow-hidden border-2 border-[#EB83EA]/40 hover:border-[#EB83EA]/70 transition-all group shadow-lg hover:shadow-[#EB83EA]/20"
      >
        <div className="relative h-32 overflow-hidden">
          <Image
            src="/dragverse-hall-of-fame.jpg"
            alt="Dragverse Hall of Fame"
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </div>
        <div className="p-5 bg-gradient-to-br from-[#2a1545] via-[#1f0d33] to-[#1a0b2e]">
          <div className="flex items-center gap-2 mb-2">
            <FiAward className="w-5 h-5 text-[#EB83EA]" />
            <h3 className="font-heading text-base font-black uppercase tracking-wide text-white">
              Dragverse Hall of Fame
            </h3>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Meet all the inductees to the Dragverse Hall of Fame
          </p>
        </div>
      </a>

      {/* Sponsored Section */}
      <div className="rounded-[24px] overflow-hidden border-2 border-[#2f2942] hover:border-[#EB83EA]/40 transition-all group shadow-lg">
        <div className="px-5 pt-4 pb-2 bg-gradient-to-br from-[#1a0b2e] via-[#1f0d33] to-[#2a1545]">
          <span className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold">
            Sponsored
          </span>
        </div>
        <a
          href="https://salti.printful.me/product/salti-25-premium-sherpa-blanket"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
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
