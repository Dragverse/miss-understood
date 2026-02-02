"use client";

import { FiFileText } from "react-icons/fi";

export default function TermsPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 pb-12">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <FiFileText className="w-6 h-6 text-[#EB83EA]" />
            </div>
            <h1 className="font-heading text-3xl lg:text-4xl uppercase tracking-wide font-black">
              Terms of Service
            </h1>
          </div>
          <p className="text-gray-400 text-sm">
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="leading-relaxed">
              By accessing and using Dragverse, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these Terms of Service, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
            <p className="leading-relaxed mb-4">
              Dragverse is a community platform for drag creators and fans to connect, share content, and thrive. The platform allows users to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Upload and share video and audio content</li>
              <li>Create posts and engage with the community</li>
              <li>Follow creators and interact with content</li>
              <li>Stream live performances</li>
              <li>Send and receive tips using cryptocurrency</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
            <p className="leading-relaxed mb-4">
              To access certain features of Dragverse, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Content Guidelines</h2>
            <p className="leading-relaxed mb-4">
              Users are responsible for the content they post. You agree not to upload or share content that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Violates any laws or regulations</li>
              <li>Infringes on intellectual property rights</li>
              <li>Contains hate speech, harassment, or bullying</li>
              <li>Is sexually explicit involving minors</li>
              <li>Promotes violence or illegal activities</li>
              <li>Contains spam or misleading information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Intellectual Property</h2>
            <p className="leading-relaxed mb-4">
              You retain ownership of content you upload to Dragverse. By posting content, you grant Dragverse a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content on the platform.
            </p>
            <p className="leading-relaxed">
              The Dragverse platform, including its design, code, and branding, is protected by copyright and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Payments and Tipping</h2>
            <p className="leading-relaxed mb-4">
              Dragverse enables cryptocurrency payments for tipping creators. You understand that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>All cryptocurrency transactions are final and non-refundable</li>
              <li>You are responsible for any transaction fees</li>
              <li>Dragverse is not responsible for cryptocurrency price fluctuations</li>
              <li>You must comply with all applicable tax obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Beta Testing</h2>
            <p className="leading-relaxed">
              Dragverse is currently in active development (beta). The platform may contain bugs, and features may change without notice. We are not liable for any data loss or service interruptions during this period.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Termination</h2>
            <p className="leading-relaxed">
              We reserve the right to suspend or terminate your account at any time for violations of these Terms of Service or for any other reason at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Limitation of Liability</h2>
            <p className="leading-relaxed">
              Dragverse is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the platform, including but not limited to direct, indirect, incidental, or consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to Terms</h2>
            <p className="leading-relaxed">
              We may update these Terms of Service from time to time. Continued use of the platform after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact</h2>
            <p className="leading-relaxed">
              For questions about these Terms of Service, please contact us through our community channels or visit our About page.
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
