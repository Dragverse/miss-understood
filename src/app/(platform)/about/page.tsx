"use client";

import Link from "next/link";
import Image from "next/image";
import { FiHeart, FiUsers, FiZap, FiGlobe } from "react-icons/fi";

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="mb-8">
          <Image
            src="/logo.svg"
            alt="Dragverse"
            width={200}
            height={80}
            className="mx-auto"
          />
        </div>
        <h1 className="text-5xl font-bold mb-6">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] bg-clip-text text-transparent">
            Dragverse
          </span>
        </h1>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
          The home for drag artists to create, connect, and thrive. Built by the community, for the community.
        </p>
      </div>

      {/* What is Dragverse */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-6 text-white">What is Dragverse?</h2>
        <p className="text-lg text-gray-300 mb-4 leading-relaxed">
          Dragverse is a platform designed specifically for drag artists and their fans. We're creating a space where creators can share their art, build their community, and earn directly from their work—without the limitations of traditional platforms.
        </p>
        <p className="text-lg text-gray-300 leading-relaxed">
          Whether you're uploading performance videos, going live, or sharing behind-the-scenes content, Dragverse gives you the tools to showcase your talent and connect with fans who love what you do.
        </p>
      </section>

      {/* Features Grid */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-8 text-white">Why Dragverse?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] rounded-xl">
                <FiHeart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white">Creator-First</h3>
                <p className="text-gray-300">
                  Built for artists by artists. Keep more of what you earn and own your content.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] rounded-xl">
                <FiUsers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white">Community Driven</h3>
                <p className="text-gray-300">
                  Connect directly with your fans and fellow artists in a supportive space.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] rounded-xl">
                <FiZap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white">Multiple Formats</h3>
                <p className="text-gray-300">
                  Share full performances, quick bytes, podcasts, music, and live streams all in one place.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] rounded-xl">
                <FiGlobe className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold mb-2 text-white">Global Reach</h3>
                <p className="text-gray-300">
                  Connect with fans and creators from around the world in one vibrant community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story (Placeholder) */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-6 text-white">Our Story</h2>
        <div className="bg-gradient-to-r from-[#EB83EA]/10 to-[#7c3aed]/10 border border-[#EB83EA]/30 rounded-2xl p-8">
          <p className="text-lg text-gray-300 leading-relaxed mb-4">
            Dragverse was born from a simple idea: drag artists deserve a platform that celebrates and supports their unique art form.
          </p>
          <p className="text-gray-300 leading-relaxed">
            We're building more than just another social platform—we're creating a home for the drag community to flourish, free from the constraints and biases of mainstream platforms.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center">
        <h2 className="text-3xl font-bold mb-6 text-white">Ready to Join?</h2>
        <p className="text-lg text-gray-300 mb-8">
          Whether you're a creator or a fan, there's a place for you in the Dragverse.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="px-8 py-3 bg-gradient-to-r from-[#EB83EA] to-[#7c3aed] hover:from-[#E748E6] hover:to-[#6b2fd5] text-white font-semibold rounded-full transition-all shadow-lg hover:shadow-xl"
          >
            Explore Dragverse
          </Link>
          <Link
            href="/tech-ethics"
            className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/20 text-white font-semibold rounded-full transition-all"
          >
            Our Technology & Ethics
          </Link>
        </div>
      </section>
    </div>
  );
}
