"use client";

import { Disclosure } from "./AdFormFields";
import { INPUT } from "../constants";

interface OrganicSubmissionFormProps {
  ogMethod: 'social' | 'email' | 'forum' | 'other';
  setOgMethod: (value: 'social' | 'email' | 'forum' | 'other') => void;
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
  return (
    <div className="bg-[#141414] border border-[#232323] rounded-2xl shadow-xl overflow-hidden w-full max-w-full sm:max-w-md mx-auto space-y-4 sm:space-y-6">
      <div className="px-6 sm:px-8 py-5 border-b border-[#232323] flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#00C2CB]">Submit Organic Promotion</h2>
      </div>

      <div className="px-6 sm:px-8 py-6 space-y-4 sm:space-y-6">
        <label className="block">
          <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Method</span>
          <select className={`${INPUT} w-full text-sm sm:text-base`} value={ogMethod} onChange={(e) => setOgMethod(e.target.value as any)}>
            <option value="social">Social Post</option>
            <option value="email">Email Campaign</option>
            <option value="forum">Forum Posting</option>
            <option value="other">Other</option>
          </select>
        </label>

        {ogMethod === 'social' && (
          <>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Platform</span>
              <select className={`${INPUT} w-full text-sm sm:text-base`} value={ogPlatform} onChange={(e) => setOgPlatform(e.target.value)}>
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
              <textarea className={`${INPUT} w-full text-sm sm:text-base`} placeholder="Write your caption…" value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} />
            </label>

            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Optional image/video</span>
              <input
                type="file"
                accept="image/*,video/*"
                className={`${INPUT} w-full text-sm sm:text-base`}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setOgFile(file || null);
                }}
              />
            </label>
          </>
        )}

        {ogMethod === 'email' && (
          <>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Subject line</span>
              <input className={`${INPUT} w-full text-sm sm:text-base`} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. A special offer just for you" />
            </label>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Email body</span>
              <textarea className={`${INPUT} w-full text-sm sm:text-base`} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="Your email body here…" />
            </label>
          </>
        )}

        {ogMethod === 'forum' && (
          <>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Forum / URL</span>
              <input className={`${INPUT} w-full text-sm sm:text-base`} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. reddit.com/r/yourcommunity" />
            </label>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Post content</span>
              <textarea className={`${INPUT} w-full text-sm sm:text-base`} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="What will you post?" />
            </label>
          </>
        )}

        {ogMethod === 'other' && (
          <>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Channel / summary</span>
              <input className={`${INPUT} w-full text-sm sm:text-base`} value={ogCaption} onChange={(e) => setOgCaption(e.target.value)} placeholder="e.g. Influencer outreach, local event, SMS, etc." />
            </label>
            <label className="block">
              <span className="text-[#00C2CB] font-semibold text-base sm:text-lg">Details</span>
              <textarea className={`${INPUT} w-full text-sm sm:text-base`} rows={6} value={ogContent} onChange={(e) => setOgContent(e.target.value)} placeholder="Describe how and where this will be executed. Include audience, platform/domain if relevant." />
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

      <div className="px-6 sm:px-8 py-5 border-t border-[#232323] flex items-center justify-end">
        <button
          onClick={handleOrganicSubmit}
          className="w-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all duration-200"
        >
          Submit for Review
        </button>
      </div>
    </div>
  );
}
