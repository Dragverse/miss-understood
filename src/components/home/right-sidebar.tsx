"use client";

import Image from "next/image";
import Link from "next/link";
import {
  FiAlertTriangle,
  FiUser,
  FiCheck,
  FiCircle,
  FiAward,
  FiGlobe,
  FiVideo,
} from "react-icons/fi";
import { usePrivy } from "@privy-io/react-auth";

export function RightSidebar() {
  const { authenticated } = usePrivy();

  return (
    <aside className="hidden lg:block space-y-6">
      {/* Platform Status */}
      <div className="p-6 rounded-[24px] bg-purple-900/20 border border-purple-900/30">
        <div className="flex items-center gap-3 mb-3 text-purple-400">
          <FiAlertTriangle className="w-5 h-5" />
          <h3 className="font-bold text-lg">Early Access</h3>
        </div>
        <p className="text-sm text-purple-300/80 leading-relaxed">
          Upload videos, build your profile, and explore content from Bluesky.
          More features coming soon!
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

      {/* Your Profile */}
      <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
        <h3 className="font-bold text-lg mb-5 flex items-center gap-3">
          <FiUser className="text-[#EB83EA] w-5 h-5" />
          Your Profile
        </h3>

        {authenticated ? (
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <FiCheck className="w-4 h-4 text-green-500" />
              <span className="line-through">Set profile name</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <FiCircle className="w-4 h-4 text-gray-500" />
              <span>Add profile bio</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <FiCircle className="w-4 h-4 text-gray-500" />
              <span>Upload profile pic</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-6">
            Sign in to complete your profile and start creating!
          </p>
        )}

        <Link
          href="/profile"
          className="block w-full py-3 bg-[#EB83EA] text-white text-sm font-extrabold rounded-full shadow-lg shadow-[#EB83EA]/20 hover:bg-[#E748E6] transition-all text-center uppercase tracking-wider"
        >
          {authenticated ? "Update Profile" : "Sign In"}
        </Link>
      </div>

      {/* Discover Creators */}
      <div className="p-6 rounded-[24px] bg-[#1a0b2e] border border-[#2f2942]">
        <div className="flex items-center gap-3 mb-4">
          <FiVideo className="text-[#EB83EA] w-5 h-5" />
          <h2 className="font-bold text-lg uppercase tracking-widest">
            Discover
          </h2>
        </div>

        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#EB83EA]/20 to-[#7c3aed]/20 flex items-center justify-center">
            <FiVideo className="w-8 h-8 text-[#EB83EA]" />
          </div>
          <p className="text-sm text-gray-400 mb-4">
            Discover creators from the Videos feed and Bluesky integration
          </p>
          <Link
            href="/videos"
            className="inline-block px-6 py-2 bg-[#EB83EA] text-white text-sm font-bold rounded-full hover:bg-[#E748E6] transition-all"
          >
            Browse Videos
          </Link>
        </div>
      </div>
    </aside>
  );
}
