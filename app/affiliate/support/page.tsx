'use client';

import { useState } from 'react';

const faqs = [
  {
    question: 'How do I get approved to promote an offer?',
    answer:
      'Find an offer in the marketplace and click "Request to Promote". Include a short note to the business. They’ll approve or reject your request.',
  },
  {
    question: 'When do I get paid?',
    answer:
      'Payouts are handled automatically after a sale is confirmed. You’ll be paid to your selected method once funds clear.',
  },
  {
    question: 'Can I promote multiple businesses?',
    answer:
      'Yes! You can request to promote as many offers as you like. Each business handles approvals separately.',
  },
  {
    question: 'What if my ad gets rejected?',
    answer:
      'You’ll be notified with feedback. Update your ad idea and resubmit — make sure it follows the brand’s guidelines.',
  },
];

export default function AffiliateSupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleSend = () => {
    alert('Message sent! Our team will get back to you shortly.');
    setMessage('');
  };

  return (
    <div className="max-w-4xl mx-auto p-10">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-2">Affiliate Support</h1>
      <p className="text-gray-600 mb-8">
        Need help? Start with these common questions, or send us a message directly.
      </p>

      {/* FAQ Section */}
      <div className="space-y-4 mb-12">
        {faqs.map((faq, index) => (
          <div key={index} className="border border-[#00C2CB]/30 rounded-xl bg-white shadow">
            <button
              onClick={() => toggle(index)}
              className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-[#f0fdfd] rounded-t-xl transition"
            >
              <span className="font-semibold text-[#00C2CB]">{faq.question}</span>
              <span className="text-[#00C2CB] text-xl">{openIndex === index ? '-' : '+'}</span>
            </button>

            {openIndex === index && (
              <div className="px-6 pb-4 pt-2 text-sm text-gray-700">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact Card */}
      <div className="bg-white border border-[#00C2CB]/30 rounded-xl p-6 shadow max-w-xl mx-auto">
        <h2 className="text-xl font-semibold text-[#00C2CB] mb-2">Still need help?</h2>
        <p className="text-sm text-gray-600 mb-4">Send us a message and our support team will reach out.</p>

        <textarea
          placeholder="Write your message here..."
          className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#00C2CB]"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          onClick={handleSend}
          className="bg-[#00C2CB] text-white px-6 py-2 rounded hover:bg-[#00b0b8] font-medium"
        >
          Send Message
        </button>
      </div>
    </div>
  );
}