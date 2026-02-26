import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Arkora',
  description: 'How Arkora collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background px-[5vw] py-8 max-w-[680px] mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-text-muted text-sm font-medium mb-8 active:opacity-60 transition-opacity"
      >
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 1L1 6l5 5" />
        </svg>
        Back
      </Link>

      <h1 className="text-2xl font-bold text-text mb-2">Privacy Policy</h1>
      <p className="text-text-muted text-sm mb-8">Last updated: February 2025</p>

      <div className="space-y-8 text-text-secondary text-sm leading-relaxed">

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">1. Overview</h2>
          <p>
            Arkora is a provably human anonymous message board built as a World App miniapp. We are committed
            to protecting your privacy. This policy explains what data we collect, how we use it, and your rights
            regarding that data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">2. Data We Collect</h2>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>
              <strong className="text-text">World ID nullifier hash</strong> — A one-way cryptographic identifier
              derived from your World ID proof. It cannot be reversed to reveal your biometric or personal data.
              We use it to enforce one-account-per-human and to associate your posts, votes, and preferences.
            </li>
            <li>
              <strong className="text-text">Wallet address</strong> — Your EVM wallet address, used for
              signing in via SIWE and for receiving WLD tips and subscriptions.
            </li>
            <li>
              <strong className="text-text">Content you create</strong> — Posts, replies, polls, and direct
              messages you send on Arkora. DMs are end-to-end encrypted; we store ciphertext only and cannot
              read their contents.
            </li>
            <li>
              <strong className="text-text">IP country code</strong> — Inferred from your IP at post creation
              time, used to power the Local feed feature. We do not store raw IP addresses.
            </li>
            <li>
              <strong className="text-text">Optional profile data</strong> — Display name (pseudoHandle),
              bio, and avatar image, if you choose to set them.
            </li>
            <li>
              <strong className="text-text">Optional GPS coordinates</strong> — Only if you enable location
              sharing in Settings. Stored per-post, not continuously tracked.
            </li>
            <li>
              <strong className="text-text">Session cookies</strong> — httpOnly cookies ({'"arkora-nh"'} and
              {' "wallet-address"'}) used to authenticate your session. They expire after 30 days of inactivity.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">3. Data We Do Not Collect</h2>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>Your name, email address, or phone number</li>
            <li>Biometric data — World ID proofs are verified by Worldcoin and we only receive a nullifier hash</li>
            <li>Raw IP addresses (only country code is inferred and stored)</li>
            <li>DM plaintext content — all DMs are E2E encrypted client-side</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">4. How We Use Your Data</h2>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>To authenticate you and prevent duplicate accounts (Sybil resistance)</li>
            <li>To display your posts, replies, and profile to other users</li>
            <li>To power feed personalization, notifications, and local feed features</li>
            <li>To calculate karma scores and reputation tiers</li>
            <li>To detect spam and policy violations via report counts</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">5. Third-Party Processors</h2>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li><strong className="text-text">Vercel</strong> — Hosting and serverless compute. Processes requests and stores logs for up to 7 days.</li>
            <li><strong className="text-text">Neon (Postgres)</strong> — Database. All data is stored encrypted at rest with 7-day automated backups.</li>
            <li><strong className="text-text">Pusher</strong> — Real-time notifications and room messaging.</li>
            <li><strong className="text-text">Hippius S3</strong> — Decentralized file storage for uploaded images.</li>
            <li><strong className="text-text">Worldcoin</strong> — World ID proof verification. Worldcoin&apos;s own privacy policy governs how your biometric data is handled by them.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">6. Data Retention</h2>
          <p>
            We retain your data for as long as your account exists. If you delete your account, your profile data
            is immediately removed and all your posts and replies are anonymized (the link between your nullifier
            hash and the content is broken). Backups may retain anonymized data for up to 7 days after deletion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">7. Your Rights (GDPR / CCPA)</h2>
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li><strong className="text-text">Access</strong> — request a copy of the data we hold about you</li>
            <li><strong className="text-text">Rectification</strong> — update your display name or bio in the app</li>
            <li><strong className="text-text">Erasure</strong> — delete your account via Settings &rarr; Delete account</li>
            <li><strong className="text-text">Portability</strong> — contact us to request an export of your data</li>
          </ul>
          <p>
            To exercise these rights, delete your account in-app or contact us at the address below. We will
            respond within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">8. Children</h2>
          <p>
            Arkora is not directed at children under 13. We do not knowingly collect data from children.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">9. Changes to This Policy</h2>
          <p>
            We may update this policy. The {"\"Last updated\""} date at the top reflects the most recent revision.
            Continued use of Arkora after changes constitutes acceptance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">10. Contact</h2>
          <p>
            For privacy inquiries or data requests, open an issue at our public repository or contact the
            Arkora team directly.
          </p>
        </section>

      </div>

      <div className="mt-12 pt-6 border-t border-border/20 flex gap-4">
        <Link href="/terms" className="text-accent text-sm font-medium hover:underline">
          Terms of Service
        </Link>
        <Link href="/" className="text-text-muted text-sm hover:underline">
          Back to Arkora
        </Link>
      </div>
    </div>
  )
}
