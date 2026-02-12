import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Dragverse",
  description: "Privacy policy for Dragverse platform",
};

export default function PrivacyPage() {
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

        <h1 className="text-4xl font-bold mb-8 text-center">Privacy Policy</h1>

        <p className="text-gray-400 mb-8">
          Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="space-y-8 text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p>
              Dragverse ("we", "us", or "our") operates the Dragverse platform at www.dragverse.app.
              This Privacy Policy explains how we collect, use, disclose, and protect your information
              when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">2.1 Authentication Information</h3>
            <p className="mb-4">
              When you create an account, we collect:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Email address</li>
              <li>Wallet addresses (if you connect a crypto wallet)</li>
              <li>Social media handles (Bluesky, Google, if you choose to connect them)</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">2.2 YouTube Data</h3>
            <p className="mb-4">
              If you connect your YouTube account, we access:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Your YouTube channel name and ID</li>
              <li>Subscriber count (for display on your profile)</li>
              <li>OAuth tokens (encrypted and stored securely)</li>
            </ul>
            <p className="mt-4">
              We use YouTube API Services to provide this functionality. By connecting your YouTube account,
              you agree to be bound by the{" "}
              <a
                href="https://www.youtube.com/t/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#EB83EA] hover:underline"
              >
                YouTube Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#EB83EA] hover:underline"
              >
                Google Privacy Policy
              </a>.
            </p>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">2.3 Content You Create</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Videos, audio files, and images you upload</li>
              <li>Posts, comments, and other content you create</li>
              <li>Profile information (display name, bio, avatar)</li>
            </ul>

            <h3 className="text-xl font-medium text-white mb-2 mt-4">2.4 Usage Data</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and location data</li>
              <li>Interaction data (videos watched, likes, comments)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use the collected information to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide and maintain the Dragverse platform</li>
              <li>Authenticate your account and verify your identity</li>
              <li>Display your YouTube subscriber count on your profile</li>
              <li>Enable cross-posting to connected social media accounts</li>
              <li>Process video uploads and streaming</li>
              <li>Send notifications about your account activity</li>
              <li>Improve our services and develop new features</li>
              <li>Prevent fraud and abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. YouTube Data Usage</h2>
            <p className="mb-4">
              Dragverse's use of information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#EB83EA] hover:underline"
              >
                Google API Services User Data Policy
              </a>, including the Limited Use requirements.
            </p>
            <p className="mb-4">Specifically:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>We only access YouTube data you explicitly authorize</li>
              <li>YouTube data is used solely to display your channel information and enable video uploads</li>
              <li>We do not sell YouTube user data to third parties</li>
              <li>We do not use YouTube data for serving advertisements</li>
              <li>OAuth tokens are encrypted and stored securely</li>
              <li>You can revoke access at any time through your Dragverse settings or{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#EB83EA] hover:underline"
                >
                  Google Account Permissions
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Data Sharing and Disclosure</h2>
            <p className="mb-4">We may share your information with:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Service Providers:</strong> Supabase (database), Livepeer (video streaming), Vercel (hosting)</li>
              <li><strong>Social Platforms:</strong> If you enable cross-posting, we share content with Bluesky or YouTube</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
            <p className="mt-4">
              We do NOT sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Security</h2>
            <p>
              We implement security measures to protect your data:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-4">
              <li>OAuth tokens are encrypted before storage</li>
              <li>Secure HTTPS connections</li>
              <li>Regular security audits</li>
              <li>Limited employee access to user data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Your Rights and Choices</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your account and associated data</li>
              <li>Disconnect YouTube or other social accounts</li>
              <li>Opt-out of non-essential communications</li>
              <li>Export your data</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, visit your account settings or contact us at{" "}
              <a href="mailto:privacy@dragverse.app" className="text-[#EB83EA] hover:underline">
                privacy@dragverse.app
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Revoking YouTube Access</h2>
            <p className="mb-4">
              You can revoke Dragverse's access to your YouTube data at any time by:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Going to your Dragverse Settings → Accounts → Disconnect YouTube, OR</li>
              <li>Visiting{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#EB83EA] hover:underline"
                >
                  Google Account Permissions
                </a>{" "}
                and removing Dragverse access
              </li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your account,
              we will delete your personal data within 30 days, except where required by law to retain it longer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Children's Privacy</h2>
            <p>
              Dragverse is not intended for users under 13 years old. We do not knowingly collect
              information from children under 13. If you believe we have collected such information,
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by posting a notice on our platform or sending an email to your registered address.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy, please contact us:
            </p>
            <ul className="list-none space-y-2 mt-4">
              <li>Email: <a href="mailto:privacy@dragverse.app" className="text-[#EB83EA] hover:underline">privacy@dragverse.app</a></li>
              <li>Website: <a href="https://www.dragverse.app" className="text-[#EB83EA] hover:underline">www.dragverse.app</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Third-Party Links</h2>
            <p>
              Dragverse contains links to YouTube, Bluesky, and other third-party services.
              We are not responsible for the privacy practices of these external sites.
              Please review their privacy policies before providing them with your information.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 text-center text-gray-500">
          <p>© {new Date().getFullYear()} Dragverse. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
