'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'How do I approve an affiliate?',
    answer:
      'Go to your Inbox or the Affiliate Requests page. You can approve or reject each request manually with one click.',
  },
  {
    question: 'Can I control the ads affiliates run?',
    answer:
      'Yes. Affiliates submit ad ideas for your approval. You can review and approve each ad before it goes live.',
  },
  {
    question: 'How does billing work?',
    answer:
      'You’re only billed once a sale is generated through an affiliate. FalconX tracks performance and automates payouts.',
  },
  {
    question: 'Can I pause an affiliate or offer?',
    answer:
      'Yes. You can pause individual affiliates or disable offers at any time through your dashboard.',
  },
];

export default function BusinessSupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleSend = () => {
    alert('Message sent! Our team will be in touch shortly.');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white px-6 md:px-10 py-12 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,194,203,0.08),transparent_50%)] pointer-events-none" />
      <h1 className="text-4xl font-extrabold text-[#00C2CB] mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 10l-6-6m0 0L6 10m6-6v16" />
        </svg>
        Business Support
      </h1>
      <p className="text-gray-400 text-sm md:text-base mb-10 max-w-2xl">
        Need help managing affiliates, campaigns, or payments? Browse our FAQs below or message the Nettmark support team directly.
      </p>

      {/* FAQ Section */}
      <div className="space-y-4 mb-12">
        {faqs.map((faq, index) => (
          <div key={index} className="border border-[#00C2CB]/20 rounded-xl bg-[#141414] hover:bg-[#191919] shadow-[0_0_10px_rgba(0,194,203,0.1)] transition duration-200">
            <button
              onClick={() => toggle(index)}
              className="w-full px-6 py-4 text-left flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-semibold text-[#00C2CB]">{faq.question}</span>
              </div>
              <span className="text-[#00C2CB] text-xl">{openIndex === index ? '-' : '+'}</span>
            </button>

            {openIndex === index && (
              <div className="px-6 pb-4 pt-2 text-sm text-gray-300">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact Card */}
      <div className="bg-[#141414] border border-[#00C2CB]/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(0,194,203,0.1)] max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-[#00C2CB] mb-2 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#00C2CB]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 14h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Still need help?
        </h2>
        <p className="text-sm text-gray-300 mb-4">
          Send us a quick message — our support team will reach out shortly.
        </p>

        <textarea
          placeholder="Write your message here..."
          className="w-full border border-[#00C2CB]/20 bg-[#0e0e0e] text-white rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#00C2CB] transition"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          onClick={handleSend}
          className="w-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold py-2.5 rounded-md transition-all duration-200 shadow-[0_0_10px_rgba(0,194,203,0.3)]"
        >
          Send Message
        </button>
      </div>

      <p className="text-center text-xs text-gray-500 mt-8">
        Nettmark © {new Date().getFullYear()} — Empowering businesses and affiliates worldwide.
      </p>
    </div>
  );
}