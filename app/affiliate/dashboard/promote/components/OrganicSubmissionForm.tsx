"use client";

import React, { useState } from "react";
import { Badge, Button } from "@/../components/ui";
import { Disclosure } from "./AdFormFields";
import { INPUT } from "../constants";

interface OrganicSubmissionFormProps {
  ogMethod: "social" | "email" | "forum" | "other";
  setOgMethod: (value: "social" | "email" | "forum" | "other") => void;
  ogPlatform: string;
  setOgPlatform: (value: string) => void;
  ogCaption: string;
  setOgCaption: (value: string) => void;
  ogContent: string;
  setOgContent: (value: string) => void;
  ogFile: File | null;
  setOgFile: (file: File | null) => void;
  handleOrganicSubmit: () => Promise<void>;
}

export function OrganicSubmissionForm({
  ogMethod,
  setOgMethod,
  ogPlatform,
  setOgPlatform,
  ogCaption,
  setOgCaption,
  ogContent,
  setOgContent,
  ogFile,
  setOgFile,
  handleOrganicSubmit,
}: OrganicSubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applyTemplate = (kind: "social" | "email" | "forum") => {
    if (kind === "social") {
      setOgCaption("Tried this and genuinely impressed. If you're curious, check it here 👇");
      setOgContent("");
      return;
    }
    if (kind === "email") {
      setOgCaption("Quick recommendation for you");
      setOgContent("Hey {{first_name}},\n\nFound something that might help with {{pain_point}}.\n\nWhy I liked it:\n- {{benefit_1}}\n- {{benefit_2}}\n\nWorth checking out here: {{tracking_link}}\n\n— {{your_name}}");
      return;
    }
    setOgCaption("reddit.com/r/yourcommunity");
    setOgContent("I tested this for {{timeframe}}.\n\nWhat worked:\n- {{result_1}}\n- {{result_2}}\n\nIf anyone wants to look at the exact one I used: {{tracking_link}}");
  };

  const onSubmitClick = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await handleOrganicSubmit();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-4 sm:px-5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="primary">Organic track</Badge>
            <Badge variant="muted">No ad spend</Badge>
          </div>
          <h2 className="text-xl font-semibold text-[#00C2CB] sm:text-2xl">Submit Organic Promotion</h2>
          <p className="mt-1 text-xs text-gray-400 sm:text-sm">Social, email, forum, or other promotion for business review.</p>
        </div>
      </div>

      <div className="space-y-4 px-4 py-5 sm:px-5 sm:py-6">
        <label className="block">
          <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Method</span>
          <select className={`${INPUT} w-full text-base`} value={ogMethod} onChange={(e) => setOgMethod(e.target.value as "social" | "email" | "forum" | "other")}>
            <option value="social">Social Post</option>
            <option value="email">Email Campaign</option>
            <option value="forum">Forum Posting</option>
            <option value="other">Other</option>
          </select>
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button type="button" onClick={() => applyTemplate("social")} variant="secondary" size="sm" className="justify-start">Use social template</Button>
          <Button type="button" onClick={() => applyTemplate("email")} variant="secondary" size="sm" className="justify-start">Use email template</Button>
          <Button type="button" onClick={() => applyTemplate("forum")} variant="secondary" size="sm" className="justify-start">Use forum template</Button>
        </div>

        {ogMethod === "social" && (
          <>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Platform</span>
              <select className={`${INPUT} w-full text-base`} value={ogPlatform} onChange={(e) => setOgPlatform(e.target.value)}>
                <option>Facebook</option>
                <option>Instagram</option>
                <option>TikTok</option>
                <option>LinkedIn</option>
                <option>X (Twitter)</option>
                <option>YouTube</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Post caption</span>
              <textarea className={`${INPUT} w-full text-base`} placeholder="Write your caption…" value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} />
            </label>

            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Optional image/video</span>
              <input
                type="file"
                accept="image/*,video/*"
                className={`${INPUT} w-full text-base`}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setOgFile(file || null);
                }}
              />
              <p className="mt-1 text-[11px] text-gray-500">Tip: MP4/H.264 works best for cross-platform preview. {ogFile ? "File attached." : "No file selected."}</p>
            </label>
          </>
        )}

        {ogMethod === "email" && (
          <>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Subject line</span>
              <input className={`${INPUT} w-full text-base`} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. A special offer just for you" />
            </label>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Email body</span>
              <textarea className={`${INPUT} w-full text-base`} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="Your email body here…" />
            </label>
          </>
        )}

        {ogMethod === "forum" && (
          <>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Forum / URL</span>
              <input className={`${INPUT} w-full text-base`} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. reddit.com/r/yourcommunity" />
            </label>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Post content</span>
              <textarea className={`${INPUT} w-full text-base`} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="What will you post?" />
            </label>
          </>
        )}

        {ogMethod === "other" && (
          <>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Channel / summary</span>
              <input className={`${INPUT} w-full text-base`} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. Influencer outreach, local event, SMS, etc." />
            </label>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Details</span>
              <textarea className={`${INPUT} w-full text-base`} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="Describe how and where this will be executed. Include audience, platform/domain if relevant." />
            </label>
          </>
        )}

        <Disclosure title="How to submit a strong organic promotion (tips & disclaimers)">
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>Share the exact copy you’ll use (caption, subject line, CTA).</li>
            <li>Include publishing context: channel, audience size, targeting, timing.</li>
            <li>If uploading creative, ensure you have usage rights.</li>
            <li>Tracked link is mandatory — make sure you’re using Nettmark’s link.</li>
          </ul>
        </Disclosure>
      </div>

      <div className="flex items-center justify-end border-t border-[var(--border)] px-4 py-4 sm:px-5">
        <Button
          type="button"
          onClick={onSubmitClick}
          disabled={isSubmitting}
          className="w-full gap-2 sm:w-auto sm:min-w-[220px]"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-[#00C2CB]" />
              Submitting…
            </>
          ) : (
            "Submit for Review"
          )}
        </Button>
      </div>
    </div>
  );
}
