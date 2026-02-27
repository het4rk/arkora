import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service - Arkora',
  description: 'Arkora Terms of Service - rules for using the platform.',
}

export default function TermsPage() {
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

      <h1 className="text-2xl font-bold text-text mb-2">Terms of Service</h1>
      <p className="text-text-muted text-sm mb-8">Last updated: February 2026</p>

      <div className="space-y-8 text-text-secondary text-sm leading-relaxed">

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">1. Acceptance</h2>
          <p>
            By accessing or using Arkora (the {'"Service"'}), you agree to these Terms of Service. If you do not
            agree, do not use the Service. These terms form a legally binding agreement between you and Arkora.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">2. Eligibility</h2>
          <p>
            You must be at least 13 years old to use Arkora. By using the Service, you represent that you meet
            this requirement. World ID verification is required to post, reply, or vote.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">3. Prohibited Content</h2>
          <p>You may not post content that:</p>
          <ul className="list-disc list-inside space-y-2 pl-2">
            <li>Is illegal in your jurisdiction or the jurisdiction where servers are located</li>
            <li>Constitutes harassment, hate speech, or targeted abuse of individuals or groups</li>
            <li>Depicts or promotes child sexual exploitation in any form</li>
            <li>Contains non-consensual intimate imagery (NCII)</li>
            <li>Threatens or incites violence against any person or group</li>
            <li>Constitutes spam, phishing, or coordinated inauthentic behavior</li>
            <li>Discloses another person&apos;s private information without consent (doxxing)</li>
            <li>Intentionally spreads dangerous misinformation about health or safety</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">4. Content Ownership</h2>
          <p>
            You retain ownership of content you post. By posting, you grant Arkora a non-exclusive, worldwide,
            royalty-free license to display and distribute your content on the platform. You represent that you
            have the rights to post any content you submit.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">5. Moderation</h2>
          <p>
            Posts that receive 5 or more unique reports are automatically hidden from public feeds pending
            review. Arkora reserves the right to remove content or terminate accounts that violate these terms,
            with or without notice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">6. Identity and Anonymity</h2>
          <p>
            Arkora is designed for anonymous expression verified by World ID. You may not attempt to circumvent
            the one-account-per-human policy, impersonate others, or use the platform to de-anonymize other users.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">7. WLD Tips and Subscriptions</h2>
          <p>
            WLD tips and subscriptions are facilitated on-chain via World Chain. Arkora does not custody funds
            and is not responsible for blockchain transaction failures. All transactions are final. Subscriptions
            are not refundable once processed on-chain.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">8. Service Availability</h2>
          <p>
            Arkora is provided {'"as is"'} without any warranty of uptime or availability. We may modify,
            suspend, or discontinue the Service at any time. We are not liable for any loss resulting from
            service interruptions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Arkora is not liable for any indirect, incidental, special,
            consequential, or punitive damages arising from your use of the Service, including loss of data or
            digital assets.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">10. Changes to These Terms</h2>
          <p>
            We may update these terms from time to time. We will update the {'"Last updated"'} date above. Continued
            use of the Service after changes constitutes acceptance of the revised terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Arkora and its operators from any claims, damages, losses,
            or expenses (including reasonable legal fees) arising from your use of the Service, your content,
            or your violation of these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">12. Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of Delaware, United States, without regard
            to conflict-of-law principles. Any disputes arising under these terms shall be resolved in the
            courts of Delaware.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-text">13. Contact</h2>
          <p>
            For questions about these terms, email us at{' '}
            <a href="mailto:arkhet@arkora.info" className="text-accent hover:underline">arkhet@arkora.info</a>.
          </p>
        </section>

      </div>

      <div className="mt-12 pt-6 border-t border-border/20 flex gap-4">
        <Link href="/privacy" className="text-accent text-sm font-medium hover:underline">
          Privacy Policy
        </Link>
        <Link href="/" className="text-text-muted text-sm hover:underline">
          Back to Arkora
        </Link>
      </div>
    </div>
  )
}
