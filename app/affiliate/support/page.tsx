"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

const CARD_SHELL =
  "rounded-3xl border border-[var(--border)] bg-[var(--card)] shadow-[0_25px_70px_rgba(0,0,0,0.08)]";
const PANEL_CARD =
  "rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_20px_55px_rgba(0,0,0,0.06)]";
const ICON_BADGE =
  "inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card)] text-[var(--primary)]";

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
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className={`${CARD_SHELL} p-6 sm:p-8`}>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#00C2CB]/20 bg-[#00C2CB]/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#7ff5fb]">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace overview
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Affiliate Support
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-[var(--muted-foreground)] sm:text-base">
                Clear answers, fast support, and zero guesswork. Browse the most
                common questions or drop us a line directly in-app.
              </p>
            </div>
            <div className="flex flex-col text-sm text-[var(--muted-foreground)]">
              <span className="font-semibold text-[var(--foreground)]">
                Typical response
              </span>
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
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--foreground)]/50">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--foreground)]/85 break-all">
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
                    <span className="text-[var(--primary)] text-xl hidden sm:inline">
                      {open ? "–" : "+"}
                    </span>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 text-sm text-[var(--muted-foreground)] leading-relaxed">
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
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                If something’s unclear or broken, message us directly. This goes
                straight to the Nettmark team.
              </p>
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or question..."
              rows={6}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] p-4 text-sm text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:border-[var(--ring)] focus:outline-none"
            />

            <button
              onClick={() => {
                alert("Message sent. Support will reach out shortly.");
                setMessage("");
              }}
              className="w-full rounded-full bg-[var(--primary)] py-3 font-semibold text-[var(--primary-foreground)] shadow-[0_12px_35px_rgba(0,194,203,0.35)] hover:brightness-110"
            >
              Send message
            </button>

            <div className="text-xs text-[var(--muted-foreground)] space-y-2">
              <p className="font-semibold text-[var(--muted-foreground)]">
                Need faster help?
              </p>
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
