# Return from Promote to offers

Status: in progress.

Problem: founder tested affiliate onboarding and found no clean back step after entering Promote; browser back led to pricing. app/affiliate/dashboard/promote/[offerId]/page.tsx has no explicit offers return. The previous completed plan only exercised the editor route request, not editor return navigation.

Intent and alignment: founder explicitly requests a clean offers back step. This continues the authorized production onboarding repair and main delivery. docs/VISION.md and PRODUCT_PRINCIPLES.md support simple, accessible participation and user control. docs/UI_DESIGN_SYSTEM.md and canonical MobileBusinessOverview use an outlined back action; reuse that language. No commercial, approval, attribution or financial behavior changes. PRODUCT.md describes old first-party onboarding; current page uses marketplace V1.

Behavior: a visible Back to offers link above both organic/paid editors. For source=onboarding it opens /onboarding/for-partners with no offer selected, preserving current organic/paid mode. Other entries return to /affiliate/marketplace. Fixed internal destinations; do not rely on document.referrer or browser history, or reopen the same selected offer. Returning does not submit content, change participation, reset onboarding completion, or spend funds.

Systems: existing Promote page, small scoped navigation component, affiliateOnboardingPath; current layout/session protection and all submission/launch handlers remain unchanged. No APIs, database/schema/migrations, secrets or remote configuration changes.

Approach: add reusable PromotionBackLink before the existing editor grid. Extend scoped types/lint to include it and browser CI with actual Promote-page rendering using authenticated fixtures; check onward/back selection, organic/paid, refresh, direct entry and narrow screens.

Trade-offs and risks: this return navigates away from the unsaved editor state (as existing navigation does); draft persistence is outside this repair. Existing participation remains server-authoritative. Browser auth and business data are mocked, so production account/database behavior remains unverified. Do not let fixture data calls submit or launch anything.

Validation planned: existing affiliate regressions, scoped strict types, integration type comparison, lint, actual Chromium small/mobile/desktop with seeded test session, existing onboarding/policy browser checks and Vercel build. Record completed evidence before merging.

Success: the rendered editor always has an in-viewport explicit offers link, clicking it opens the correct offer list with no selected offer; users can choose a different business and no submission/financial writes occur.

## Discovered session restoration race
Actual page rendering exposed app/affiliate/layout.tsx using useSession() alone, treating its initial null as a finished unauthenticated state. This can queue a login redirect while the provider is still restoring an existing cookie session; the page's own guard can also redirect if mounted during that interval. Providers.tsx supplies SessionContextProvider without initialSession. Normal source query changes were first isolated in an established fixture session; later onboarding refresh reproduced the same premature redirect.
Update the layout to use SessionContextProvider's isLoading state: show loading and defer redirects until restoration finishes. A completed null session still redirects to the existing login destination; the existing child/Promote page only mounts after the authenticated layout is ready. Reuse the existing session provider, no auth keys/cookies/policies/server handlers change.
This is a correction to the existing access boundary, not new access permission or role behavior. /api/onboarding/affiliate-offers still independently calls auth.getUser and verifies affiliate role. Add an unauthenticated browser case proving the editor is withheld and login receives the intended next URL. No database queries/schema changes.
