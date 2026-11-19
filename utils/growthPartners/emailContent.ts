import type { RenderNettmarkEmailArgs } from '../email/renderNettmarkEmail';

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
  adminNotify(reviewUrl: string): RenderNettmarkEmailArgs {
    return {
      previewText: 'A Growth Partner application is ready for review.',
      badge: { text: 'Review needed', tone: 'warning' },
      heading: 'New Growth Partner application',
      body: 'An application is ready for review.',
      cta: { label: 'Review applications', href: reviewUrl },
    };
  },
};
