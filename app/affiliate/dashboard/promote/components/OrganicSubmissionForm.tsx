"use client";

import { useState } from "react";
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
    <div className="bg-[#141414] border border-[#232323] rounded-2xl shadow-xl overflow-hidden w-full max-w-full mx-auto">
      <div className="px-4 sm:px-8 py-5 border-b border-[#232323] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#00C2CB]">Submit Organic Promotion</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">Mobile-friendly, no ad spend required.</p>
        </div>
        <span className="hidden sm:inline-flex text-xs px-2 py-1 rounded-full border border-[#00C2CB]/40 text-[#7ff5fb]">Organic track</span>
      </div>

      <div className="px-4 sm:px-8 py-6 space-y-4 sm:space-y-6">
        <label className="block">
          <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Method</span>
          <select className={`${INPUT} w-full text-base`} value={ogMethod} onChange={(e) => setOgMethod(e.target.value as any)}>
            <option value="social">Social Post</option>
            <option value="email">Email Campaign</option>
            <option value="forum">Forum Posting</option>
            <option value="other">Other</option>
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button type="button" onClick={() => applyTemplate("social")} className="px-3 py-2 text-xs rounded-lg border border-[#2a2a2a] hover:border-[#00C2CB]/50 hover:bg-[#101b1c] text-left">Use social template</button>
          <button type="button" onClick={() => applyTemplate("email")} className="px-3 py-2 text-xs rounded-lg border border-[#2a2a2a] hover:border-[#00C2CB]/50 hover:bg-[#101b1c] text-left">Use email template</button>
          <button type="button" onClick={() => applyTemplate("forum")} className="px-3 py-2 text-xs rounded-lg border border-[#2a2a2a] hover:border-[#00C2CB]/50 hover:bg-[#101b1c] text-left">Use forum template</button>
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

      <div className="px-4 sm:px-8 py-5 border-t border-[#232323] flex items-center justify-end">
        <button
          onClick={onSubmitClick}
          disabled={isSubmitting}
          className={`w-full sm:w-auto sm:min-w-[240px] font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all duration-200 ${
            isSubmitting ? "bg-[#1a1a1a] text-gray-400 cursor-not-allowed" : "bg-[#00C2CB] hover:bg-[#00b0b8] text-black"
          }`}
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-gray-500 border-t-[#00C2CB] animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit for Review"
          )}
        </button>
      </div>
    </div>
  );
}
