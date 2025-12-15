

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-[#0b0f10] text-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-semibold text-[#00C2CB] mb-6">
          Terms of Service
        </h1>

        <p className="text-sm text-gray-400 mb-10">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            These Terms of Service (“Terms”) govern your access to and use of{" "}
            <strong>Nettmark</strong> (“Nettmark”, “we”, “us”, or “our”),
            including our website, applications, and related services (the
            “Platform”). By accessing or using Nettmark, you agree to be bound by
            these Terms. If you do not agree, you may not use the Platform.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            1. Eligibility & Accounts
          </h2>
          <p>
            You must be at least 18 years old to use Nettmark. You are responsible
            for maintaining the confidentiality of your account and for all
            activity that occurs under your account. You agree to provide
            accurate and current information.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            2. Platform Overview
          </h2>
          <p>
            Nettmark is a marketplace that connects businesses seeking marketing
            and advertising services with affiliates who promote offers through
            paid or organic channels. Nettmark provides tools for submission,
            approval, tracking, and payments but does not act as an employer,
            agent, or partner of users.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            3. Business Responsibilities
          </h2>
          <p>
            Businesses are responsible for the accuracy, legality, and
            compliance of their offers and advertising content. Businesses
            approve or reject affiliate submissions at their discretion and
            authorize Nettmark to interact with connected advertising platforms
            on their behalf.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            4. Affiliate Responsibilities
          </h2>
          <p>
            Affiliates agree to promote offers accurately, comply with
            advertising laws and platform policies, and only run ads or publish
            content after required approvals. Misrepresentation or deceptive
            promotion may result in suspension or termination.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            5. Advertising Platforms
          </h2>
          <p>
            When you connect third-party platforms such as Meta (Facebook or
            Instagram), you grant Nettmark permission to access necessary data
            via APIs. Nettmark does not guarantee ad approval, performance, or
            results. All third-party platforms are governed by their own terms
            and policies.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            6. Payments, Wallets & Payouts
          </h2>
          <p>
            Payments and payouts are processed through third-party providers such
            as Stripe. Nettmark does not store full payment card details. Wallet
            balances, payouts, and deductions are tracked for operational and
            compliance purposes.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            7. Tracking & Attribution
          </h2>
          <p>
            Nettmark uses tracking links, cookies, and conversion events to
            attribute traffic and conversions, calculate payouts, and prevent
            fraud. Tracking accuracy is not guaranteed and may be affected by
            third-party platforms or technical limitations.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            8. Prohibited Conduct
          </h2>
          <p>
            You agree not to engage in fraudulent, misleading, abusive, or
            unlawful conduct, to circumvent approval or tracking systems, or to
            upload malicious or unauthorized content. Violations may result in
            immediate suspension or termination.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            9. Intellectual Property
          </h2>
          <p>
            The Nettmark platform, branding, software, and content are owned by
            Nettmark or its licensors. User-submitted content remains the
            property of the submitting user, subject to platform usage rights.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            10. Termination
          </h2>
          <p>
            Nettmark may suspend or terminate access for violations of these
            Terms, legal or compliance reasons, or to protect platform integrity.
            You may stop using the platform at any time.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            11. Disclaimers
          </h2>
          <p>
            Nettmark is provided “as is” and “as available.” We make no warranties
            regarding campaign performance, revenue outcomes, platform
            availability, or third-party platform behavior.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            12. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, Nettmark shall not be liable
            for indirect, incidental, or consequential damages, loss of profits
            or data, or actions of third-party platforms or users.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            13. Changes to These Terms
          </h2>
          <p>
            We may update these Terms from time to time. Continued use of the
            platform after changes constitutes acceptance of the updated Terms.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            14. Contact
          </h2>
          <p>
            If you have questions about these Terms, contact us at:
          </p>

          <p>
            <strong>Email:</strong> contact@nettmark.com
            <br />
            <strong>Website:</strong> https://nettmark.com
          </p>
        </div>
      </div>
    </main>
  );
}