"use client";

import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0f071a] mt-auto">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Copyright */}
          <div className="text-sm text-gray-400">
            © {currentYear} Dragverse. All rights reserved.
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/terms"
              className="text-gray-400 hover:text-[#EB83EA] transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-gray-400 hover:text-[#EB83EA] transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/about"
              className="text-gray-400 hover:text-[#EB83EA] transition-colors"
            >
              About
            </Link>
            <Link
              href="/tech-ethics"
              className="text-gray-400 hover:text-[#EB83EA] transition-colors"
            >
              Tech & Ethics
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
