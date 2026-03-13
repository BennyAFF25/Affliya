"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How do I approve an affiliate?",
    answer:
      "Go to your Inbox or the Affiliate Requests page. You can approve or reject each request manually with one click.",
  },
  {
    question: "Can I control the ads affiliates run?",
    answer:
      "Yes. Affiliates submit ad ideas for your approval. You can review and approve each ad before it goes live.",
  },
  {
    question: "How does billing work?",
    answer:
      "You’re only billed once a sale is generated through an affiliate. FalconX tracks performance and automates payouts.",
  },
  {
    question: "Can I pause an affiliate or offer?",
    answer:
      "Yes. You can pause individual affiliates or disable offers at any time through your dashboard.",
  },
];

export default function BusinessSupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleSend = () => {
    alert("Message sent! Our team will be in touch shortly.");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] px-6 md:px-10 py-12 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in oklab, var(--primary) 12%, transparent),transparent_50%)] pointer-events-none" />
      <h1 className="text-4xl font-extrabold text-[var(--primary)] mb-3 flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-8 h-8 text-[var(--primary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18 10l-6-6m0 0L6 10m6-6v16"
          />
        </svg>
        Business Support
      </h1>
      <p className="text-[var(--muted-foreground)] text-sm md:text-base mb-10 max-w-2xl">
        Need help managing affiliates, campaigns, or payments? Browse our FAQs
        below or message the Nettmark support team directly.
      </p>

      {/* FAQ Section */}
      <div className="space-y-4 mb-12">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[0_0_10px_rgba(0,0,0,0.08)] hover:bg-[var(--secondary)] transition duration-200"
          >
            <button
              onClick={() => toggle(index)}
              className="w-full px-6 py-4 text-left flex justify-between items-center"
            >
              <div className="flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-[var(--primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="font-semibold text-[var(--primary)]">
                  {faq.question}
                </span>
              </div>
              <span className="text-[var(--primary)] text-xl">
                {openIndex === index ? "-" : "+"}
              </span>
            </button>

            {openIndex === index && (
              <div className="px-6 pb-4 pt-2 text-sm text-[var(--muted-foreground)]">
                {faq.answer}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contact Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_0_20px_rgba(0,0,0,0.10)] max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-[var(--primary)] mb-2 flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-[var(--primary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 14h.01M16 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Still need help?
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Send us a quick message — our support team will reach out shortly.
        </p>

        <textarea
          placeholder="Write your message here..."
          className="mb-4 w-full rounded-lg border border-[var(--border)] bg-[var(--input-background)] p-3 text-sm text-[var(--foreground)] transition focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          onClick={handleSend}
          className="w-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:brightness-110 font-semibold py-2.5 rounded-md transition-all duration-200 shadow-[0_0_10px_rgba(0,194,203,0.3)]"
        >
          Send Message
        </button>
      </div>

      <p className="text-center text-xs text-[var(--muted-foreground)] mt-8">
        Nettmark © {new Date().getFullYear()} — Empowering businesses and
        affiliates worldwide.
      </p>
    </div>
  );
}
