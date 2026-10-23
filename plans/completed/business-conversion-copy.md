# Business conversion copy

Status: completed.

Problem and product intent: Apply the founder's exact launch positioning and clearer card terms on business acquisition/signup pages. This supports documented affiliate-funded distribution without changing prices, entitlement, billing, or the dark/teal design. Hero headlines remain unchanged.

Existing implementation: BusinessDemoLandingPage and for-businesses are client pages; create-account currently hardcodes plan=growth. choose-plan has legacy and trial-first variants, with server-verified prior selections and Stripe eligibility. Subscription checkout collects a card, uses 14 days, and cancels without a payment method. Paid launch gating is conditional on feature flags (docs/BUSINESS_RULES.md agrees); deployed flags are unverified.

Approach: Update copy in both landing pages and signup variants; preserve explicit URL plan and server-confirmed choices. Replace category strip with a cached server count query using the existing service-client factory, passing only integer counts to the client. Count offers by non-private participation_mode and profiles by affiliate role, as verified in migrations. Hide unavailable/empty counts.

Affected systems/user impact: marketing display and business plan presentation only. Existing checkout actions, authentication, attribution and entitlement remain intact. No SQL, remote configuration, commit or push.

Trade-offs and risks: aggregate counts cache for one hour; no individual records selected. Exact requested price copy retains existing verified-price eligibility guards. Live database and deployed flags unverified; query failures hide the strip.

Success criteria/validation: exact copy, unchanged headlines, explicit Free preserved, aggregate-only queries and silent fallback. Passed node_modules/.bin/tsc -p . --noEmit; node --import tsx suites: business-conversion-copy, business-onboarding-funnel, business-funnel-routes, business-entitlements, business-subscription-gate, business-subscriptions. Updated browser CTA selector and stale gate price assertion. Strengthened checkout test for 14 days and missing-payment-method cancellation. git diff --check passed.

Remaining limitations: signup-profile-provisioning test fails on existing metadata assertion (line 14); a trial correction exposed additional unrelated stale auth-redirect assertion, so that file was left unchanged. No browser/build/lint checks run; copy and cached server counts have targeted checks. Live schema/counts and deployed feature flags were not queried. No SQL, configuration, commit, push or deployment.
