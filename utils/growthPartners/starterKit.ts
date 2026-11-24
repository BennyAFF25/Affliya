// Partner starter kit copy. Every statement here must match the implemented programme rules
// (utils/creatorReferrals.ts, utils/growthPartners/commissionMath.ts and the growth_partners migration).
export const LINK_PLACEHOLDER = '[your referral link]';

export const starterKitSteps = [
  { title: 'Share your link', body: 'Send your personal /r/ link to business owners. The first partner link a business clicks is remembered on that browser for 60 days.' },
  { title: 'They sign up and pay', body: 'The business creates a Nettmark account and starts a monthly subscription through your link. Any free trial comes first; commission starts with their first paid month.' },
  { title: 'You earn', body: 'You earn 50% of their eligible subscription revenue, excluding GST, for their first 3 paid months. Each commission is held for 14 days, then reviewed and approved by Nettmark before it is paid out.' },
];

export const starterKitAudience = [
  'Shopify, ecommerce and direct-to-consumer brands that want more sales without paying upfront agency fees.',
  'Businesses already running Meta (Facebook and Instagram) ads who want more people driving results for them.',
  'Founders and small teams who would rather pay for performance than for a retainer.',
];

export const starterKitPitch = {
  headline: 'Why businesses say yes',
  points: [
    'Nettmark affiliates fund and run ads directly on the business’s own Meta ad account. It is not a standard affiliate platform that relies on coupon codes and tracking links alone.',
    'Because affiliates put up the ad spend, the business pays for performance instead of upfront agency costs.',
    'Everything runs on the business’s own ad account, not on someone else’s.',
  ],
};

export type StarterTemplate = { id: string; title: string; hint: string; body: string };

export function starterKitTemplates(referralUrl: string | null): StarterTemplate[] {
  const link = referralUrl || LINK_PLACEHOLDER;
  return [
    {
      id: 'cold-dm', title: 'Cold DM', hint: 'Instagram, Facebook or LinkedIn message',
      body: `Hi [Name], love what you're building with [Brand]. Quick one: have you come across Nettmark? Affiliates fund and run Meta ads for your products directly on your own ad account, so you pay for performance rather than an upfront agency fee. I'm a Nettmark Growth Partner and thought it could suit you. Here's a look: ${link}`,
    },
    {
      id: 'email', title: 'Email intro', hint: 'Personal email to a business owner',
      body: `Subject: More Meta ad sales for [Brand], without the agency retainer\n\nHi [Name],\n\nI'm a Growth Partner with Nettmark and wanted to share something that could suit [Brand].\n\nNettmark connects brands with affiliates who fund and run Meta ads directly on the brand's own ad account. Unlike a standard affiliate platform, the ads run natively on your account and you pay for performance instead of upfront agency costs.\n\nYou can see how it works and sign up here: ${link}\n\nHappy to answer any questions.\n\n[Your name]`,
    },
    {
      id: 'social-post', title: 'LinkedIn or social post', hint: 'Post to your own audience',
      body: `Ecommerce and DTC founders: most affiliate programmes stop at a coupon code. Nettmark goes further. Affiliates fund and run Meta ads directly on your brand's own ad account, so you pay for performance, not an upfront agency retainer. If you're already running Meta ads (or want to), it's worth a look. I'm a Nettmark Growth Partner: ${link}`,
    },
    {
      id: 'text-intro', title: 'Short text intro', hint: 'SMS, WhatsApp or a quick reply',
      body: `Hey [Name], thought of you. Nettmark lets affiliates fund and run Meta ads on your own ad account, so you pay for performance, not agency fees. Worth a look (I'm a partner): ${link}`,
    },
  ];
}

export const starterKitDos = [
  'Personalise each message and reach out to businesses that genuinely fit.',
  'Say that you are a Nettmark Growth Partner when you share your link.',
  'Ask businesses to sign up on the same device and browser where they opened your link.',
];

export const starterKitDonts = [
  'No spam: no bulk unsolicited messages, bought lists or comment flooding.',
  'Don’t bid on “Nettmark” or similar brand terms in search ads.',
  'Don’t make misleading claims about results, sales or income.',
  'No self-referrals: your own businesses, or accounts using your email, don’t earn commission.',
  'Referrals from businesses on the same company email domain as you are flagged for manual review.',
];

export const starterKitFaq = [
  { q: 'How long does my link last?', a: 'The first partner link a business clicks is remembered on that browser for 60 days (first touch). A later click on another partner’s link doesn’t replace it. If the business clears cookies or signs up on a different device or browser, the referral can’t be tracked.' },
  { q: 'Which businesses count?', a: 'New businesses that create a Nettmark account and start a subscription at nettmark.com after clicking your link. Businesses that were already on Nettmark, or had already started a subscription or trial, don’t count.' },
  { q: 'What do I earn?', a: '50% of eligible monthly subscription revenue, excluding GST, for each business’s first 3 paid months. Free trial periods and month 4 onwards don’t earn commission.' },
  { q: 'When do I get paid?', a: 'Each commission is held for 14 days after the payment, then reviewed and approved by Nettmark. Approved commissions are then paid out by Nettmark, and you can track every stage on this dashboard.' },
  { q: 'What if a business gets a refund?', a: 'A month that is fully refunded before payout earns nothing and doesn’t count towards the 3 months. If a payment is refunded after you were paid, the amount is deducted from a later payout.' },
];
