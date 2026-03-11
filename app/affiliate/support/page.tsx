"use client";

import { useState } from "react";

const CARD_SHELL =
  "rounded-3xl border border-white/10 bg-[#0c1118]/95 shadow-[0_25px_70px_rgba(0,0,0,0.55)]";
const PANEL_CARD =
  "rounded-2xl border border-white/10 bg-[#111317]/90 shadow-[0_20px_55px_rgba(0,0,0,0.45)]";
const ICON_BADGE =
  "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[#00C2CB]";

const faqs = [
  {
    question: "How do I get approved to promote an offer?",
    answer:
      "Go to the Marketplace, choose an offer, and click “Request to Promote”. Businesses manually review and approve requests.",
  },
  {
    question: "When do I get paid?",
    answer:
      "Payouts are processed automatically once a sale is confirmed and the hold period clears.",
  },
  {
    question: "Can I promote multiple businesses?",
    answer:
      "Yes. You can promote multiple businesses at once, as long as each approves you.",
  },
  {
    question: "What if my ad gets rejected?",
    answer:
      "You’ll receive feedback from the business. Update the ad and resubmit for review.",
  },
];

export default function AffiliateSupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  return (
    <div className="min-h-screen bg-surface text-white px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className={`${CARD_SHELL} p-6 sm:p-8 space-y-4`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                Need help?
              </p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Affiliate Support
              </h1>
              <p className="mt-2 text-white/65 max-w-2xl text-sm sm:text-base">
                Clear answers, fast support, and zero guesswork. Browse the most
                common questions or drop us a line directly in-app.
              </p>
            </div>
            <div className="flex flex-col text-sm text-white/60">
              <span className="font-semibold text-white">Typical response</span>
              <span>Under 24 hours</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Live inbox", value: "support@nettmark.com" },
              { label: "Help center", value: "docs.nettmark.com" },
              { label: "Status", value: "status.nettmark.com" },
            ].map((item) => (
              <div key={item.label} className={`${PANEL_CARD} p-4`}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-white/80 break-all">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="space-y-4">
            {faqs.map((faq, index) => {
              const open = openIndex === index;
              return (
                <div key={faq.question} className={PANEL_CARD}>
                  <button
                    onClick={() => setOpenIndex(open ? null : index)}
                    className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className={ICON_BADGE}>{open ? "–" : "+"}</span>
                      <p className="font-semibold text-base">{faq.question}</p>
                    </div>
                    <span className="text-[#00C2CB] text-xl hidden sm:inline">
                      {open ? "–" : "+"}
                    </span>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 text-sm text-white/70 leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <aside className={`${CARD_SHELL} p-6 space-y-5`}>
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <span className={ICON_BADGE}>✉️</span>
                Contact support
              </h2>
              <p className="mt-2 text-sm text-white/65">
                If something’s unclear or broken, message us directly. This goes
                straight to the Nettmark team.
              </p>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question..."
              rows={6}
              className="w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white placeholder-white/30 focus:border-[#00C2CB] focus:outline-none"
            />

            <button
              onClick={() => {
                alert("Message sent. Support will reach out shortly.");
                setMessage("");
              }}
              className="w-full rounded-full bg-[#00C2CB] py-3 font-semibold text-black shadow-[0_12px_35px_rgba(0,194,203,0.35)] hover:bg-[#00b0b8]"
            >
              Send message
            </button>

            <div className="text-xs text-white/55 space-y-2">
              <p className="font-semibold text-white/70">Need faster help?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  Use the in-app chat bubble (bottom-right) for live triage.
                </li>
                <li>
                  Ping @nettmark-support inside the VS Code Live Share session.
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
