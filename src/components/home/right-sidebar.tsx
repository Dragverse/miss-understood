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
        <p className="text-sm text-purple-200 leading-relaxed">
          Dragverse is in active development. More features will come as we continue to grow.
        </p>
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
      <a
        href="https://salti.printful.me/product/salti-25-premium-sherpa-blanket"
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-[24px] overflow-hidden border border-[#2f2942] hover:border-[#EB83EA]/40 transition-all group"
      >
        <div className="px-4 pt-4 pb-2 bg-gradient-to-br from-[#1a0b2e] to-[#2a1545]">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
            Sponsored
          </span>
        </div>
        <div className="relative aspect-square overflow-hidden">
          <Image
            src="/salti-blanket.webp"
            alt="Salti Premium Sherpa Blanket"
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      </a>
    </aside>
  );
}
