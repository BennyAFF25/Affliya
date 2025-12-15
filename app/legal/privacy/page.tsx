export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#0b0f10] text-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-semibold text-[#00C2CB] mb-6">
          Privacy Policy
        </h1>

        <p className="text-sm text-gray-400 mb-10">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            This Privacy Policy explains how <strong>Nettmark</strong> (“Nettmark”,
            “we”, “us”, or “our”) collects, uses, stores, and shares information
            when you use our website, applications, and services (the “Platform”).
            By using Nettmark, you agree to the practices described in this policy.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            1. Information We Collect
          </h2>

          <h3 className="font-semibold text-gray-200">
            1.1 Account Information
          </h3>
          <p>
            When you create an account as a business or affiliate, we may collect
            your name, email address, account role, and authentication identifiers.
          </p>

          <h3 className="font-semibold text-gray-200">
            1.2 Business & Advertising Data
          </h3>
          <p>
            Businesses using Nettmark may provide advertising assets, campaign
            details, targeting preferences, and connected advertising account
            identifiers (such as Meta ad account IDs), as well as performance data
            including spend, clicks, and conversions.
          </p>

          <h3 className="font-semibold text-gray-200">
            1.3 Affiliate Data
          </h3>
          <p>
            Affiliates may submit ad ideas, organic post content, and promotional
            materials, and may receive tracking links and performance metrics
            related to their promotions.
          </p>

          <h3 className="font-semibold text-gray-200">
            1.4 Automatically Collected Information
          </h3>
          <p>
            We may automatically collect limited technical information such as IP
            address, device type, browser, and platform usage data. This
            information is used for security, analytics, and system performance.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            2. How We Use Information
          </h2>
          <p>
            We use collected information to operate and maintain the platform,
            facilitate connections between businesses and affiliates, enable
            advertising campaign review and approval, process payments and
            payouts, track performance and attribution, improve platform
            reliability, and comply with legal obligations.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            3. Advertising & Tracking
          </h2>

          <h3 className="font-semibold text-gray-200">
            3.1 Meta (Facebook & Instagram)
          </h3>
          <p>
            If you connect a Meta account, Nettmark may access advertising assets
            and campaign data via Meta APIs. Ads are created and managed only with
            explicit business authorization. Nettmark does not publish ads without
            business approval and complies with Meta Platform Policies.
          </p>

          <h3 className="font-semibold text-gray-200">
            3.2 Tracking & Attribution
          </h3>
          <p>
            Nettmark may use tracking links, cookies, or similar technologies to
            attribute traffic and conversions, calculate performance and payouts,
            and prevent fraud or misuse. These technologies are used solely for
            operational purposes.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            4. Payments & Financial Information
          </h2>
          <p>
            Payments are processed by third-party providers such as Stripe.
            Nettmark does not store full payment card details. All financial
            transactions are handled by PCI-compliant payment processors.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            5. Data Sharing
          </h2>
          <p>
            We may share information with service providers, advertising platforms
            you explicitly connect, or when required by law. We do not sell
            personal data or share it for unrelated marketing purposes.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            6. Data Retention
          </h2>
          <p>
            We retain information only as long as necessary to provide services,
            comply with legal requirements, resolve disputes, and enforce platform
            policies. You may request account deletion at any time.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            7. Data Deletion & Account Removal
          </h2>
          <p>
            You may request deletion of your Nettmark account and associated personal
            data at any time by contacting us at <strong>contact@nettmark.com</strong>.
            Upon account deletion, Nettmark will remove or anonymise personal information
            where reasonably possible and revoke access to any connected third-party
            services, including Meta (Facebook and Instagram) advertising accounts.
          </p>
          <p>
            Advertising and transaction data may be retained in an aggregated or
            anonymised form where required for legal, compliance, fraud prevention, or
            financial record-keeping purposes, but such data will no longer be linked to
            an identifiable user.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            8. Security
          </h2>
          <p>
            We implement reasonable technical and organizational measures to
            protect data, including secure authentication, encrypted
            communications, and access controls. No system is completely secure,
            but we actively work to safeguard user information.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            9. Your Rights
          </h2>
          <p>
            Depending on your location, you may have rights to access, correct, or
            delete your personal information, or to withdraw consent where
            applicable. You may contact us to exercise these rights.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            10. Children’s Privacy
          </h2>
          <p>
            Nettmark is not intended for individuals under the age of 18. We do
            not knowingly collect personal data from children.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            11. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. Updates will be
            posted on this page with a revised “Last updated” date.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            12. Contact Us
          </h2>
          <p>
            If you have questions about this Privacy Policy, you can contact us at:
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