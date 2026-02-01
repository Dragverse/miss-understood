"use client";

import Image from "next/image";
import {
  FiAlertTriangle,
  FiCheck,
  FiCircle,
  FiAward,
  FiGlobe,
} from "react-icons/fi";

export function RightSidebar() {

  return (
    <aside className="hidden lg:block space-y-6">
      {/* Platform Status - Beta */}
      <div className="p-6 rounded-[24px] bg-purple-900/20 border border-purple-500/40">
        <div className="flex items-center gap-3 mb-3">
          <FiAlertTriangle className="w-5 h-5 text-purple-400" />
          <span className="px-3 py-1 bg-purple-500/30 rounded-full text-xs font-bold text-purple-300 uppercase">
            Beta
          </span>
        </div>
        <p className="text-sm text-purple-200 leading-relaxed mb-3">
          Dragverse is in active development. Some features may be incomplete or change over time.
        </p>
        <div className="space-y-2 text-xs text-purple-300/80">
          <div className="flex items-start gap-2">
            <FiCheck className="w-4 h-4 flex-shrink-0 text-green-400 mt-0.5" />
            <span>Upload videos & build your profile</span>
          </div>
          <div className="flex items-start gap-2">
            <FiCheck className="w-4 h-4 flex-shrink-0 text-green-400 mt-0.5" />
            <span>Browse content from Bluesky & YouTube</span>
          </div>
          <div className="flex items-start gap-2">
            <FiCircle className="w-3 h-3 flex-shrink-0 text-purple-500 mt-1 ml-0.5" />
            <span className="opacity-60">Live streaming (invite-only)</span>
          </div>
          <div className="flex items-start gap-2">
            <FiCircle className="w-3 h-3 flex-shrink-0 text-purple-500 mt-1 ml-0.5" />
            <span className="opacity-60">Monetization features (coming soon)</span>
          </div>
        </div>
      </div>

      {/* Dragverse Worlds */}
      <a
        href="https://world.dragverse.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-[24px] overflow-hidden border border-[#EB83EA]/30 hover:border-[#EB83EA]/60 transition-all group"
      >
        <div className="relative h-24 overflow-hidden">
          <Image
            src="/dragverse-hall-of-fame.jpg"
            alt="Dragverse Hall of Fame"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="p-4 bg-gradient-to-br from-[#2a1545] to-[#1a0b2e]">
          <div className="flex items-center gap-2 mb-1">
            <FiAward className="w-4 h-4 text-[#EB83EA]" />
            <h3 className="font-bold text-sm">Hall of Fame</h3>
          </div>
          <p className="text-xs text-gray-400">
            Celebrate our legendary creators.
          </p>
        </div>
      </a>

      <a
        href="https://hyperfy.io/dragverse/"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-[24px] overflow-hidden border border-[#7c3aed]/30 hover:border-[#7c3aed]/60 transition-all group"
      >
        <div className="relative h-24 overflow-hidden">
          <Image
            src="/dragverse.jpg"
            alt="Dragverse Realm"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="p-4 bg-gradient-to-br from-[#1a2545] to-[#1a0b2e]">
          <div className="flex items-center gap-2 mb-1">
            <FiGlobe className="w-4 h-4 text-[#7c3aed]" />
            <h3 className="font-bold text-sm">Dragverse Realm</h3>
          </div>
          <p className="text-xs text-gray-400">
            Enter the immersive 3D world.
          </p>
        </div>
      </a>

      {/* Ad Section */}
      <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#1a0b2e] to-[#2a1545] border border-[#2f2942]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Sponsored
          </span>
        </div>

        <div className="text-center py-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#EB83EA]/10 to-[#7c3aed]/10 border border-[#EB83EA]/20 flex items-center justify-center">
            <span className="text-3xl">🎯</span>
          </div>
          <p className="text-sm text-gray-400 mb-2 font-semibold">
            Your brand here
          </p>
          <p className="text-xs text-gray-500">
            Reach thousands of engaged creators and viewers
          </p>
        </div>
      </div>
    </aside>
  );
}
