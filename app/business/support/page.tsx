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
    <div className="max-w-4xl mx-auto p-10">
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-2">Business Support</h1>
      <p className="text-gray-600 mb-8">
        Questions about managing affiliates, campaigns, or payments? Start here or message us below.
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