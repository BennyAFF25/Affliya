import React from "react";

export type LegalPolicy = "terms" | "privacy" | "cookies";
export const POLICY_TITLES: Record<LegalPolicy, string> = {
  terms: "Terms of Service", privacy: "Privacy Policy", cookies: "Cookie Policy",
};

export default function LegalPolicyContent({ policy, showTitle = true }: { policy: LegalPolicy; showTitle?: boolean }) {
  if (policy === "terms") return <TermsOfServiceContent showTitle={showTitle} />;
  if (policy === "privacy") return <PrivacyPolicyContent showTitle={showTitle} />;
  return <CookiePolicyContent showTitle={showTitle} />;
}

function TermsOfServiceContent({ showTitle }: { showTitle: boolean }) {
  return (
    <React.Fragment>
        {showTitle && <h1 className="text-3xl font-semibold text-[#00C2CB] mb-6">
          Terms of Service
        </h1>}

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
    </React.Fragment>
  );
}

function PrivacyPolicyContent({ showTitle }: { showTitle: boolean }) {
  return (
    <React.Fragment>
        {showTitle && <h1 className="text-3xl font-semibold text-[#00C2CB] mb-6">
          Privacy Policy
        </h1>}

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
    </React.Fragment>
  );
}

function CookiePolicyContent({ showTitle }: { showTitle: boolean }) {
  return (
    <React.Fragment>
        {showTitle && <h1 className="text-3xl font-semibold text-[#00C2CB] mb-6">
          Cookie Policy
        </h1>}

        <p className="text-sm text-gray-400 mb-10">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="space-y-6 text-sm leading-relaxed text-gray-300">
          <p>
            This Cookie Policy explains how <strong>Nettmark</strong> (“Nettmark”,
            “we”, “us”, or “our”) uses cookies and similar technologies when you
            visit or use our website, applications, and services (the
            “Platform”). This policy should be read together with our Privacy
            Policy.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            1. What Are Cookies?
          </h2>
          <p>
            Cookies are small text files placed on your device when you visit a
            website. They help websites remember information about your visit,
            such as login state or preferences.
          </p>
          <p>
            We may also use similar technologies such as localStorage, pixels,
            tags, or device identifiers for security, analytics, and attribution.
            For simplicity, all such technologies are referred to as “cookies”
            in this policy.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            2. Why Nettmark Uses Cookies
          </h2>

          <h3 className="font-semibold text-gray-200">
            2.1 Essential Platform Functionality
          </h3>
          <p>
            These cookies are required for the Platform to function correctly,
            including authentication, security, fraud prevention, load
            balancing, and remembering basic preferences. Disabling essential
            cookies may prevent the Platform from working properly.
          </p>

          <h3 className="font-semibold text-gray-200">
            2.2 Analytics & Performance
          </h3>
          <p>
            We may use limited analytics cookies to understand how users interact
            with Nettmark, such as pages visited, features used, and performance
            issues. This helps us improve reliability and user experience.
          </p>

          <h3 className="font-semibold text-gray-200">
            2.3 Tracking & Attribution
          </h3>
          <p>
            Because Nettmark supports affiliate tracking, cookies or similar
            technologies may be used to attribute visits or conversions to an
            affiliate, prevent fraudulent attribution, and calculate
            performance, commissions, and payouts.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            3. Types of Cookies We Use
          </h2>
          <p>
            Nettmark may use essential cookies, performance or analytics cookies,
            and attribution cookies where applicable. We aim to collect only the
            data necessary to operate the platform effectively.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            4. Third-Party Cookies
          </h2>
          <p>
            Some third-party services connected to Nettmark may set their own
            cookies, including advertising platforms you connect (such as Meta)
            and payment processors like Stripe. These third parties operate under
            their own privacy and cookie policies, which Nettmark does not
            control.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            5. Managing Cookies
          </h2>
          <p>
            You can control or delete cookies through your browser settings. Most
            browsers allow you to block cookies or receive alerts before cookies
            are stored. Please note that blocking some cookies may affect the
            functionality of Nettmark, including login, security, and tracking
            features.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            6. Changes to This Cookie Policy
          </h2>
          <p>
            We may update this Cookie Policy from time to time. Updates will be
            posted on this page with a revised “Last updated” date.
          </p>

          <h2 className="text-lg font-semibold text-[#00C2CB]">
            7. Contact
          </h2>
          <p>
            If you have questions about this Cookie Policy, you can contact us
            at:
          </p>

          <p>
            <strong>Email:</strong> contact@nettmark.com
            <br />
            <strong>Website:</strong> https://nettmark.com
          </p>
        </div>
    </React.Fragment>
  );
}

