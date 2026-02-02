"use client";

import { FiShield } from "react-icons/fi";

export default function PrivacyPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-12">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <FiShield className="w-6 h-6 text-[#EB83EA]" />
            </div>
            <h1 className="font-heading text-3xl lg:text-4xl uppercase tracking-wide font-black">
              Privacy Policy
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p className="leading-relaxed">
              At Dragverse, we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
            <p className="leading-relaxed mb-4">
              We collect several types of information to provide and improve our services:
            </p>

            <h3 className="text-xl font-semibold text-white mb-3">Account Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Email address or social media handles (when you sign up)</li>
              <li>Profile information (display name, avatar, bio)</li>
              <li>Wallet addresses (for cryptocurrency transactions)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3">Content and Activity</h3>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li>Videos, audio, and posts you upload</li>
              <li>Comments, likes, and interactions</li>
              <li>Viewing history and preferences</li>
              <li>Livestream activities</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3">Technical Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>IP address and device information</li>
              <li>Browser type and settings</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar technologies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
            <p className="leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and send related information</li>
              <li>Send notifications about your account and platform updates</li>
              <li>Respond to your comments, questions, and support requests</li>
              <li>Analyze usage patterns to improve user experience</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Sharing and Disclosure</h2>
            <p className="leading-relaxed mb-4">
              We do not sell your personal information. We may share your data in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Public Content:</strong> Content you post publicly is visible to all users</li>
              <li><strong>Service Providers:</strong> Third-party services that help us operate the platform (hosting, analytics, payment processing)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Blockchain and Cryptocurrency</h2>
            <p className="leading-relaxed">
              Cryptocurrency transactions are recorded on public blockchains. These transactions are permanent and publicly visible. Your wallet address may be linked to your Dragverse account and visible to other users when you send or receive tips.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Third-Party Services</h2>
            <p className="leading-relaxed mb-4">
              Dragverse integrates with third-party services, including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Authentication:</strong> Privy for wallet and social login</li>
              <li><strong>Video Hosting:</strong> Livepeer for video storage and streaming</li>
              <li><strong>Social Platforms:</strong> Bluesky and Farcaster for social connections</li>
              <li><strong>Analytics:</strong> Usage tracking to improve our platform</li>
            </ul>
            <p className="leading-relaxed mt-4">
              These services have their own privacy policies. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Data Security</h2>
            <p className="leading-relaxed">
              We implement industry-standard security measures to protect your data. However, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Data Retention</h2>
            <p className="leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide services. You may request deletion of your account and associated data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Your Rights</h2>
            <p className="leading-relaxed mb-4">
              You have the right to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access and update your personal information</li>
              <li>Request deletion of your data</li>
              <li>Opt out of marketing communications</li>
              <li>Export your data</li>
              <li>Object to processing of your personal data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Children's Privacy</h2>
            <p className="leading-relaxed">
              Dragverse is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected data from a child, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. International Users</h2>
            <p className="leading-relaxed">
              Dragverse operates globally. Your information may be transferred to and processed in countries other than your own. By using our platform, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">12. Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">13. Contact Us</h2>
            <p className="leading-relaxed">
              If you have questions about this Privacy Policy or how we handle your data, please contact us through our community channels or visit our About page.
            </p>
          </section>
        </div>

        {/* Back to Home */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[#EB83EA] hover:text-[#E748E6] transition-colors font-medium"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}
