'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'How do I get approved to promote an offer?',
    answer:
      'Go to the Marketplace, choose an offer, and click “Request to Promote”. Businesses manually review and approve requests.',
  },
  {
    question: 'When do I get paid?',
    answer:
      'Payouts are processed automatically once a sale is confirmed and the hold period clears.',
  },
  {
    question: 'Can I promote multiple businesses?',
    answer:
      'Yes. You can promote multiple businesses at once, as long as each approves you.',
  },
  {
    question: 'What if my ad gets rejected?',
    answer:
      'You’ll receive feedback from the business. Update the ad and resubmit for review.',
  },
];

export default function AffiliateSupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  return (
    <div className="min-h-screen bg-[#0a0d0f] text-white px-6 py-14">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-16">
          <h1 className="text-4xl font-semibold tracking-tight">
            Affiliate Support
          </h1>
          <p className="mt-3 text-white/60 max-w-xl">
            Clear answers, fast support, and zero guesswork.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* FAQ Column */}
          <div className="lg:col-span-2 space-y-4">
            {faqs.map((faq, index) => {
              const open = openIndex === index;
              return (
                <div
                  key={index}
                  className="border border-white/10 rounded-xl bg-[#0f1316]"
                >
                  <button
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="font-medium text-white">
                      {faq.question}
                    </span>
                    <span className="text-[#00C2CB] text-lg">
                      {open ? '–' : '+'}
                    </span>
                  </button>

                  {open && (
                    <div className="px-6 pb-6 text-sm text-white/70 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Support Card */}
          <div className="relative rounded-2xl border border-[#00C2CB]/30 bg-[#0e1114] p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Contact support
              </h2>
              <p className="mt-2 text-sm text-white/60">
                If something’s unclear or broken, message us directly.
              </p>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question..."
              rows={6}
              className="w-full rounded-lg bg-[#0a0d0f] border border-white/10 p-4 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#00C2CB]/50"
            />

            <button
              onClick={() => {
                alert('Message sent. Support will reach out shortly.');
                setMessage('');
              }}
              className="mt-5 w-full rounded-lg bg-[#00C2CB] py-3 font-semibold text-black hover:bg-[#00b0b8]"
            >
              Send message
            </button>

            <div className="mt-6 text-xs text-white/40">
              Typical response time: under 24 hours
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}