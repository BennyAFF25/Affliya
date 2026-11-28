import React from "react";
import { TERMS_PUBLISHED_LABEL, TERMS_VERSION } from "../../../utils/legal/version";

/*
 * Terms of Service v2 (terms-2026-12-v2). DRAFT pending Australian legal review.
 * Rendered only when NEXT_PUBLIC_TERMS_V2_ENABLED=true. Adds clause 7
 * (Subscriptions, Free Trials, Cancellation and Refunds), renumbers the
 * clauses after it, adds the Australian Consumer Law carve-out to the
 * disclaimer and liability clauses, replaces the variation clause, and names
 * the contracting entity and governing law.
 */
const h2 = "text-lg font-semibold text-[#00C2CB]";
const h3 = "font-semibold text-white";
const ACL_CARVE_OUT = "Nothing in these Terms excludes, restricts or modifies any right or remedy, or any guarantee, warranty or other term or condition, implied or imposed by the Australian Consumer Law or any other law that cannot lawfully be excluded or limited.";

export default function TermsOfServiceV2Content({ showTitle }: { showTitle: boolean }) {
  return (
    <React.Fragment>
      {showTitle && <h1 className="text-3xl font-semibold text-[#00C2CB] mb-6">Terms of Service</h1>}

      <p className="text-sm text-gray-400 mb-10" data-terms-version={TERMS_VERSION}>
        Last updated: {TERMS_PUBLISHED_LABEL} · Version {TERMS_VERSION}
      </p>

      <div className="space-y-6 text-sm leading-relaxed text-gray-300">
        <p>
          These Terms of Service (“Terms”) govern your access to and use of <strong>Nettmark</strong>, operated by
          Nettmark Pty Ltd (ABN 51 690 432 298), South Australia (“Nettmark”, “we”, “us”, or “our”), including our
          website, applications, and related services (the “Platform”). By accessing or using Nettmark, you agree to be
          bound by these Terms. If you do not agree, you may not use the Platform.
        </p>

        <h2 className={h2}>1. Eligibility & Accounts</h2>
        <p>
          You must be at least 18 years old to use Nettmark. You are responsible for maintaining the confidentiality of
          your account and for all activity that occurs under your account. You agree to provide accurate and current
          information.
        </p>

        <h2 className={h2}>2. Platform Overview</h2>
        <p>
          Nettmark is a marketplace that connects businesses seeking marketing and advertising services with affiliates
          who promote offers through paid or organic channels. Nettmark provides tools for submission, approval,
          tracking, and payments but does not act as an employer, agent, or partner of users.
        </p>

        <h2 className={h2}>3. Business Responsibilities</h2>
        <p>
          Businesses are responsible for the accuracy, legality, and compliance of their offers and advertising content.
          Businesses approve or reject affiliate submissions at their discretion and authorize Nettmark to interact with
          connected advertising platforms on their behalf.
        </p>

        <h2 className={h2}>4. Affiliate Responsibilities</h2>
        <p>
          Affiliates agree to promote offers accurately, comply with advertising laws and platform policies, and only run
          ads or publish content after required approvals. Misrepresentation or deceptive promotion may result in
          suspension or termination.
        </p>

        <h2 className={h2}>5. Advertising Platforms</h2>
        <p>
          When you connect third-party platforms such as Meta (Facebook or Instagram), you grant Nettmark permission to
          access necessary data via APIs. Nettmark does not guarantee ad approval, performance, or results. All
          third-party platforms are governed by their own terms and policies.
        </p>

        <h2 className={h2}>6. Payments, Wallets & Payouts</h2>
        <p>
          Payments and payouts are processed through third-party providers such as Stripe. Nettmark does not store full
          payment card details. Wallet balances, payouts, and deductions are tracked for operational and compliance
          purposes.
        </p>

        <h2 className={h2} id="subscriptions-refunds">7. Subscriptions, Free Trials, Cancellation and Refunds</h2>
        <p><span className={h3}>7.1 Who you are contracting with.</span> Paid plans are supplied by Nettmark Pty Ltd (ABN 51 690 432 298), South Australia. Payments are processed by Stripe.</p>
        <div className="space-y-2">
          <p><span className={h3}>7.2 Growth plan and free trial.</span></p>
          <p>(a) The Growth plan costs A$49 per month, or any other price shown to you at checkout. Applicable tax is shown at checkout.</p>
          <p>(b) If you’re eligible, Growth starts with a 14-day free trial. A payment card is required to start it. You can only use one free trial per business.</p>
          <p>(c) <strong>Unless you cancel before your trial ends, your trial automatically becomes a paid Growth subscription when it ends, and we will charge your card A$49 on that day and on the same day every month after that until you cancel.</strong> The date your trial ends is shown before you start it and in the confirmation email we send you.</p>
          <p>(d) We will email you a reminder at least 7 days before your trial ends.</p>
        </div>
        <p><span className={h3}>7.3 Recurring billing.</span> By starting a trial or subscription you authorise us, through Stripe, to charge your nominated payment method each month in advance until you cancel. You’re responsible for keeping your payment details current.</p>
        <div className="space-y-2">
          <p><span className={h3}>7.4 How to cancel.</span></p>
          <p>(a) You can cancel at any time in Nettmark under <strong>Settings → Subscription &amp; billing → Manage subscription</strong> (or “Manage or cancel trial”), or through the secure Stripe billing link in any billing email. You don’t need to be signed in to Nettmark to use the Stripe link.</p>
          <p>(b) If you cancel during a free trial, you won’t be charged. Your trial access continues until the trial end date.</p>
          <p>(c) If you cancel a paid subscription, no further charges will be made. You’ll keep Growth access until the end of the billing period you’ve already paid for, and then your account moves to the Free plan.</p>
          <p>(d) We’ll email you to confirm your cancellation.</p>
        </div>
        <div className="space-y-2">
          <p><span className={h3}>7.5 Refunds.</span></p>
          <p>(a) <strong>Subscription payments are non-refundable, except where required by law (including the Australian Consumer Law) or where clause 7.5(c) applies.</strong> In particular, we don’t give refunds for:</p>
          <ul className="list-[lower-roman] space-y-1 pl-10">
            <li>change of mind;</li>
            <li>not using, or not fully using, the platform during a billing period;</li>
            <li>forgetting to cancel before a trial or billing period ends; or</li>
            <li>partial billing periods after you cancel.</li>
          </ul>
          <p>(b) This clause doesn’t stop you claiming any remedy you’re entitled to under the Australian Consumer Law. See clause 7.8.</p>
          <p>(c) We may give a refund or credit at our discretion. Doing so once doesn’t oblige us to do it again.</p>
        </div>
        <p><span className={h3}>7.6 Failed payments.</span> If a payment fails, we’ll email you, and Stripe may retry the payment over the following days. If the payment still hasn’t been made when the retries finish, we may suspend Growth features or cancel your subscription. Outstanding amounts remain payable.</p>
        <p><span className={h3}>7.7 Price changes.</span> We’ll give you at least 30 days’ email notice before any change to your subscription price takes effect. If you don’t agree with the change, you can cancel before it takes effect and you won’t be charged the new price.</p>
        <p><span className={h3}>7.8 Your rights under the Australian Consumer Law.</span> Our services come with guarantees that can’t be excluded under the Australian Consumer Law. If there’s a major failure with the service, you’re entitled to cancel your service contract with us and to a refund for the unused portion, or to compensation for its reduced value. You’re also entitled to be compensated for any other reasonably foreseeable loss or damage. If a failure doesn’t amount to a major failure, you’re entitled to have the problem with the service rectified in a reasonable time. If that isn’t done, you’re entitled to cancel your contract and get a refund for the unused portion. To the extent the law allows, and where the service isn’t of a kind ordinarily acquired for personal, domestic or household use, our liability for a failure to comply with a consumer guarantee is limited to supplying the service again or paying the cost of having it supplied again.</p>
        <p><span className={h3}>7.9 Chargebacks.</span> If you think a charge is wrong, please contact contact@nettmark.com first. We aim to respond within 2 business days.</p>

        <h2 className={h2}>8. Tracking & Attribution</h2>
        <p>
          Nettmark uses tracking links, cookies, and conversion events to attribute traffic and conversions, calculate
          payouts, and prevent fraud. Tracking accuracy is not guaranteed and may be affected by third-party platforms or
          technical limitations.
        </p>

        <h2 className={h2}>9. Prohibited Conduct</h2>
        <p>
          You agree not to engage in fraudulent, misleading, abusive, or unlawful conduct, to circumvent approval or
          tracking systems, or to upload malicious or unauthorized content. Violations may result in immediate suspension
          or termination.
        </p>

        <h2 className={h2}>10. Intellectual Property</h2>
        <p>
          The Nettmark platform, branding, software, and content are owned by Nettmark or its licensors. User-submitted
          content remains the property of the submitting user, subject to platform usage rights.
        </p>

        <h2 className={h2}>11. Termination</h2>
        <p>
          Nettmark may suspend or terminate access for violations of these Terms, legal or compliance reasons, or to
          protect platform integrity. You may stop using the platform at any time.
        </p>

        <h2 className={h2}>12. Disclaimers</h2>
        <p>
          Nettmark is provided “as is” and “as available.” We make no warranties regarding campaign performance, revenue
          outcomes, platform availability, or third-party platform behavior.
        </p>
        <p>{ACL_CARVE_OUT}</p>

        <h2 className={h2}>13. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Nettmark shall not be liable for indirect, incidental, or consequential
          damages, loss of profits or data, or actions of third-party platforms or users.
        </p>
        <p>{ACL_CARVE_OUT}</p>

        <h2 className={h2}>14. Changes to These Terms</h2>
        <p>
          We may update these Terms. For changes that materially affect you (including pricing or refund terms) we will
          give at least 30 days’ notice by email or in-app, and you may cancel before the change takes effect. Where
          required, we will ask you to accept the updated Terms.
        </p>

        <h2 className={h2}>15. Governing Law</h2>
        <p>
          These Terms are governed by the laws of South Australia, Australia. You and we submit to the non-exclusive
          jurisdiction of the courts of South Australia.
        </p>

        <h2 className={h2}>16. Contact</h2>
        <p>If you have questions about these Terms, contact us at:</p>
        <p>
          <strong>Nettmark Pty Ltd</strong> (ABN 51 690 432 298)
          <br />
          <strong>Email:</strong> contact@nettmark.com
          <br />
          <strong>Website:</strong> https://nettmark.com
        </p>
      </div>
    </React.Fragment>
  );
}
