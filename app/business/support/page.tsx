"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";

const faqs = [
  {
    question: "How do I approve an affiliate?",
    answer:
      "Open your Inbox or Affiliate Requests page to review each incoming request. You can approve or reject partners individually once you’ve checked fit and intent.",
  },
  {
    question: "Can I control the ads affiliates run?",
    answer:
      "Yes. Affiliates submit ad ideas for approval before paid campaigns go live. Organic post ideas can also be reviewed before they move into your active campaign flow.",
  },
  {
    question: "How does billing work now?",
    answer:
      "Nettmark no longer relies on subscription-style business billing surfaces. You manage payouts, top-ups, approved campaigns, and operational money flow directly inside the platform.",
  },
  {
    question: "Can I pause an affiliate or offer?",
    answer:
      "Yes. You can pause affiliates, stop approving new creatives, or disable offers from your business dashboard whenever you need to slow or stop activity.",
  },
];

const quickLinks = [
  {
    title: "Review requests",
    body: "Approve affiliates, ad ideas, and post ideas from one queue.",
    href: "/business/inbox",
    label: "Open inbox",
  },
  {
    title: "Manage campaigns",
    body: "Check what’s live, monitor placements, and review campaign status.",
    href: "/business/manage-campaigns",
    label: "View campaigns",
  },
  {
    title: "Business settings",
    body: "Update business profile details and security settings.",
    href: "/business/settings",
    label: "Open settings",
  },
];

export default function BusinessSupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [message, setMessage] = useState("");

  const trimmedMessage = message.trim();
  const remainingHint = useMemo(() => {
    if (!trimmedMessage) return "Tell us what’s blocked, what page you’re on, and what you expected to happen.";
    if (trimmedMessage.length < 30) return "A bit more detail will help support respond faster.";
    return "Looks good — include links, campaign names, or offer names if they matter.";
  }, [trimmedMessage]);

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  const handleSend = () => {
    if (!trimmedMessage) {
      toast.error("Add a short message first");
      return;
    }

    toast.success("Support note saved for follow-up");
    setMessage("");
  };

  return (
    <div className="min-h-screen bg-[var(--background)] px-6 py-12 text-[var(--foreground)] md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,color-mix(in_oklab,var(--primary)_14%,transparent),transparent_40%)]" />

      <div className="relative mx-auto max-w-6xl space-y-10">
        <section className="rounded-[32px] border border-[var(--border)] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_35%),var(--card)] p-8 shadow-[0_25px_80px_rgba(0,0,0,0.16)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--primary)]">
                Business support
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--foreground)] md:text-5xl">
                Get unstuck fast
              </h1>
              <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)] md:text-base">
                Find the right business workflow, check common answers, or leave a note for follow-up when something needs a human hand.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">FAQ answers</div>
                <div className="mt-1 text-2xl font-bold text-[var(--foreground)]">{faqs.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Quick routes</div>
                <div className="mt-1 text-2xl font-bold text-[var(--foreground)]">{quickLinks.length}</div>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-black/10 px-4 py-3 col-span-2 sm:col-span-1">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Support mode</div>
                <div className="mt-1 text-2xl font-bold text-[var(--foreground)]">Live</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1.2fr,0.8fr]">
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Frequently asked questions</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                The high-friction business workflows, without the scavenger hunt.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = openIndex === index;
                return (
                  <div
                    key={faq.question}
                    className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition hover:border-[var(--primary)]/35"
                  >
                    <button
                      onClick={() => toggle(index)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                          ?
                        </span>
                        <span className="font-semibold text-[var(--foreground)]">{faq.question}</span>
                      </div>
                      <span className="text-xl font-light text-[var(--primary)]">{isOpen ? "−" : "+"}</span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[var(--border)] px-6 pb-5 pt-3 text-sm leading-6 text-[var(--muted-foreground)]">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_12px_35px_rgba(0,0,0,0.10)]">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Quick routes</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Jump straight to the pages that solve most support questions.
              </p>

              <div className="mt-5 space-y-3">
                {quickLinks.map((item) => (
                  <a
                    key={item.title}
                    href={item.href}
                    className="block rounded-2xl border border-[var(--border)] bg-black/10 p-4 transition hover:border-[var(--primary)]/35 hover:bg-[var(--primary)]/5"
                  >
                    <div className="text-sm font-semibold text-[var(--foreground)]">{item.title}</div>
                    <div className="mt-1 text-sm text-[var(--muted-foreground)]">{item.body}</div>
                    <div className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">{item.label}</div>
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_12px_35px_rgba(0,0,0,0.10)]">
              <h2 className="text-2xl font-semibold text-[var(--foreground)]">Still need help?</h2>
              <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                Leave a concise note for follow-up. Include the page, offer, affiliate, or campaign involved if you can.
              </p>

              <textarea
                placeholder="Example: Approved ad idea still shows in inbox, or payouts are enabled but campaign launch is blocked…"
                className="mt-4 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] p-4 text-sm text-[var(--foreground)] transition focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />

              <p className="mt-3 text-xs text-[var(--muted-foreground)]">{remainingHint}</p>

              <button
                onClick={handleSend}
                className="mt-4 w-full rounded-xl bg-[var(--primary)] py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_0_16px_rgba(0,194,203,0.25)] transition hover:brightness-110"
              >
                Send support note
              </button>
            </section>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--muted-foreground)]">
          Nettmark © {new Date().getFullYear()} — business, affiliate, and campaign support in one place.
        </p>
      </div>
    </div>
  );
}
