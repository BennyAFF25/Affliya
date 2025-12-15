

export default function CookiePolicy() {
  return (
    <main className="min-h-screen bg-[#0b0f10] text-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <h1 className="text-3xl font-semibold text-[#00C2CB] mb-6">
          Cookie Policy
        </h1>

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
      </div>
    </main>
  );
}