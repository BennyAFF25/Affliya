import type { RenderNettmarkEmailArgs } from '../email/renderNettmarkEmail';

export type AdminApplicationDetails = { full_name: string; email: string; category: string; audience_estimate: string; profile_url: string; attribution?: Record<string, string>; flags?: string[] };
const label = (value: string) => value.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());

export const growthEmailContent = {
  magicLink(url: string): RenderNettmarkEmailArgs {
    return {
      previewText: 'Your secure Growth Partner sign-in link.',
      badge: { text: 'Secure sign-in', tone: 'info' },
      heading: 'Your secure sign-in link',
      body: 'Use this link to access your Growth Partner dashboard.',
      notice: { body: "This link expires soon and can only be used once. If you didn't request it, you can ignore this email.", tone: 'info' },
      cta: { label: 'Sign in', href: url },
    };
  },
  approved(referralUrl: string, loginUrl: string): RenderNettmarkEmailArgs {
    return {
      previewText: 'Your application is approved. Your referral link is ready.',
      badge: { text: 'Approved', tone: 'success' },
      heading: 'Welcome to the programme',
      body: 'Share your personal link with business owners and follow your referrals in your dashboard.',
      rows: [
        { label: 'Referral link', value: referralUrl, href: referralUrl },
        { label: 'Commission', value: '50% of eligible subscription revenue, excluding GST' },
        { label: 'Duration', value: 'First 3 paid months' },
        { label: 'Eligible', value: 'Nettmark plans paid at nettmark.com through your link, not Shopify App Store installs' },
        { label: 'Payouts', value: 'Reviewed and approved by Nettmark after a 14-day hold' },
      ],
      cta: { label: 'Sign in', href: loginUrl },
    };
  },
  received(): RenderNettmarkEmailArgs {
    return {
      previewText: 'Thank you for applying to the Growth Partner Programme.',
      badge: { text: 'Application received', tone: 'info' },
      heading: 'Thank you for applying',
      body: 'We review every application. If approved, you will receive your referral link and sign-in instructions by email.',
    };
  },
  adminNotify(reviewUrl: string, application?: AdminApplicationDetails): RenderNettmarkEmailArgs {
    if (!application) return { previewText: 'A Growth Partner application is ready for review.', badge: { text: 'Review needed', tone: 'warning' }, heading: 'New Growth Partner application', body: 'An application is ready for review.', cta: { label: 'Review application', href: reviewUrl } };
    const a = application.attribution || {};
    const source = [a.utm_source, a.utm_medium].filter(Boolean).join(' / ');
    const rows = [
      { label: 'Name', value: application.full_name },
      { label: 'Email', value: application.email, href: `mailto:${application.email}` },
      { label: 'Category', value: label(application.category) },
      { label: 'Business owners reached', value: application.audience_estimate },
      { label: 'Profile', value: application.profile_url, href: /^https?:\/\//i.test(application.profile_url) ? application.profile_url : undefined },
      { label: 'Source', value: source || (a.fbclid ? 'facebook (click id only)' : 'Direct / unknown') },
      ...(a.utm_campaign ? [{ label: 'Campaign', value: a.utm_campaign }] : []),
      { label: 'Applied on', value: a.landing_path || 'Unknown page' },
      ...(a.landing_referrer ? [{ label: 'Referrer', value: a.landing_referrer }] : []),
    ];
    return {
      previewText: `${application.full_name} applied to the Growth Partner Programme.`,
      badge: { text: 'Review needed', tone: 'warning' },
      heading: 'New Growth Partner application',
      body: `${application.full_name} has applied. Review the details and approve or reject it in the admin page.`,
      rows,
      ...(application.flags?.length ? { notice: { title: 'Check before approving', body: application.flags.join(' · '), tone: 'warning' as const } } : {}),
      cta: { label: 'Review application', href: reviewUrl },
      footerNote: 'Approving sends the partner their referral link. Nothing happens until you approve.',
    };
  },
};
