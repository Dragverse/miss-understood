import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Terms of Service - Dragverse",
  description: "Terms of service for Dragverse platform",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0a0118] text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image
            src="/logo.svg"
            alt="Dragverse Logo"
            width={200}
            height={60}
            className="h-12 w-auto"
          />
        </div>

        <h1 className="text-4xl font-bold mb-8 text-center">Terms of Service</h1>

        <p className="text-gray-400 mb-8">
          Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using Dragverse ("the Platform"), you agree to be bound by these Terms of Service
              and all applicable laws and regulations. If you do not agree with any of these terms, you are
              prohibited from using or accessing this site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
            <p>
              Dragverse is a decentralized video streaming platform designed for drag artists and performers.
              The Platform allows users to upload, share, and monetize video content, connect social media accounts,
              and engage with the drag community.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. User Accounts</h2>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">3.1 Account Creation</h3>
            <p className="mb-4">
              To use certain features of the Platform, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Be responsible for all activities under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">3.2 Age Requirement</h3>
            <p>
              You must be at least 13 years old to use Dragverse. Users between 13-18 years old must have
              parental consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Content Guidelines</h2>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">4.1 Your Content</h3>
            <p className="mb-4">
              You retain ownership of content you upload. By uploading content, you grant Dragverse a
              non-exclusive, worldwide, royalty-free license to host, store, display, and distribute your
              content on the Platform.
            </p>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">4.2 Prohibited Content</h3>
            <p className="mb-4">You may not upload content that:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Violates copyright, trademark, or other intellectual property rights</li>
              <li>Contains illegal content or promotes illegal activities</li>
              <li>Harasses, threatens, or bullies individuals or groups</li>
              <li>Contains spam, malware, or phishing attempts</li>
              <li>Impersonates another person or entity</li>
              <li>Violates the privacy of others</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">4.3 Adult Content</h3>
            <p>
              Adult content is permitted on Dragverse but must be properly tagged as NSFW. Users under 18
              will not be able to view NSFW-tagged content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. YouTube Integration</h2>
            <p className="mb-4">
              When you connect your YouTube account:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You authorize Dragverse to access your YouTube channel data</li>
              <li>You agree to YouTube's Terms of Service and Google's Privacy Policy</li>
              <li>Dragverse may display your YouTube subscriber count on your profile</li>
              <li>Dragverse may upload videos to your YouTube channel (if you enable this feature)</li>
              <li>You can revoke access at any time through your account settings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Monetization and Tipping</h2>
            <p className="mb-4">
              Dragverse allows users to receive tips via cryptocurrency wallets:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Dragverse does not control cryptocurrency transactions</li>
              <li>All crypto transactions are final and irreversible</li>
              <li>You are responsible for reporting earnings for tax purposes</li>
              <li>Dragverse may charge platform fees on future monetization features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Intellectual Property</h2>
            <p>
              The Dragverse platform, including its design, code, and branding, is owned by Dragverse and
              protected by copyright and trademark laws. You may not copy, modify, or distribute our
              intellectual property without permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Third-Party Services</h2>
            <p className="mb-4">
              Dragverse integrates with third-party services including:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Livepeer (video streaming)</li>
              <li>Supabase (data storage)</li>
              <li>YouTube (video platform)</li>
              <li>Bluesky (social media)</li>
              <li>Privy (authentication)</li>
            </ul>
            <p className="mt-4">
              Your use of these services is subject to their respective terms and policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Disclaimer of Warranties</h2>
            <p>
              THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. DRAGVERSE DOES NOT GUARANTEE
              UNINTERRUPTED ACCESS, ERROR-FREE OPERATION, OR SECURITY OF USER DATA. USE THE PLATFORM AT YOUR
              OWN RISK.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Limitation of Liability</h2>
            <p>
              DRAGVERSE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES
              ARISING FROM YOUR USE OF THE PLATFORM, INCLUDING LOST REVENUE, DATA LOSS, OR SERVICE INTERRUPTIONS.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Termination</h2>
            <p className="mb-4">
              We reserve the right to suspend or terminate your account if you violate these Terms of Service.
              You may also delete your account at any time through your account settings.
            </p>
            <p>
              Upon termination, your right to use the Platform will immediately cease, and we may delete
              your content and data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Changes to Terms</h2>
            <p>
              We may update these Terms of Service at any time. Significant changes will be communicated
              via email or platform notification. Continued use of the Platform after changes constitutes
              acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the United States,
              without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">14. Contact Information</h2>
            <p>
              For questions about these Terms of Service, contact us at:
            </p>
            <ul className="list-none space-y-2 mt-4">
              <li>Email: <a href="mailto:legal@dragverse.app" className="text-[#EB83EA] hover:underline">legal@dragverse.app</a></li>
              <li>Website: <a href="https://www.dragverse.app" className="text-[#EB83EA] hover:underline">www.dragverse.app</a></li>
            </ul>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-500">
          <p>© {new Date().getFullYear()} Dragverse. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
