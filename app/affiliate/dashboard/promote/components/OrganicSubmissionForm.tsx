"use client";

import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  FileImage,
  Image as ImageIcon,
  Instagram,
  Leaf,
  Link2,
  MessageCircleMore,
  Send,
  Sparkles,
  Twitter,
  Upload,
  Youtube,
} from "lucide-react";
import { Disclosure } from "./AdFormFields";

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
  selectedBrandCreative?: {
    title?: string | null;
    caption?: string | null;
    media_url: string;
    media_type: string;
    thumbnail_url?: string | null;
    allow_organic?: boolean;
    organic_preapproved?: boolean;
  } | null;
  usingBrandContent?: boolean;
  onSwitchToBrandContent?: () => void;
  onSwitchToUploadOwn?: () => void;
  handleOrganicSubmit: () => Promise<void>;
}

const SOCIAL_PLATFORMS = [
  "Facebook",
  "Instagram",
  "X (Twitter)",
  "TikTok",
  "YouTube",
  "Blog",
  "Other",
] as const;

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
  selectedBrandCreative,
  usingBrandContent,
  onSwitchToBrandContent,
  onSwitchToUploadOwn,
  handleOrganicSubmit,
}: OrganicSubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canLaunchInstantly =
    !!usingBrandContent && !!selectedBrandCreative?.allow_organic && !!selectedBrandCreative?.organic_preapproved;

  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ogFile || usingBrandContent) {
      setUploadPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(ogFile);
    setUploadPreviewUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [ogFile, usingBrandContent]);

  const previewMediaUrl = useMemo(() => {
    if (usingBrandContent && selectedBrandCreative?.media_url) {
      return selectedBrandCreative.media_url;
    }
    return uploadPreviewUrl;
  }, [selectedBrandCreative, uploadPreviewUrl, usingBrandContent]);

  const previewIsVideo = useMemo(() => {
    if (usingBrandContent && selectedBrandCreative?.media_type) {
      return String(selectedBrandCreative.media_type).toLowerCase() === "video";
    }
    return !!ogFile && ogFile.type.startsWith("video/");
  }, [ogFile, selectedBrandCreative, usingBrandContent]);

  const platformLabel = ogMethod === "social"
    ? ogPlatform || "Platform not selected"
    : ogMethod === "email"
      ? "Email"
      : ogMethod === "forum"
        ? "Forum / Community"
        : "Other organic channel";

  const captionLabel = ogMethod === "email"
    ? ogCaption || "Your subject line will appear here..."
    : ogMethod === "forum"
      ? ogContent || "Your forum post will appear here..."
      : ogMethod === "other"
        ? ogContent || ogCaption || "Your promotion summary will appear here..."
        : ogCaption || selectedBrandCreative?.caption || "Your caption will appear here...";

  const applyTemplate = (kind: "social" | "email" | "forum") => {
    if (kind === "social") {
      setOgMethod("social");
      setOgCaption("Tried this and genuinely impressed. If you're curious, check it here 👇");
      setOgContent("");
      return;
    }
    if (kind === "email") {
      setOgMethod("email");
      setOgCaption("Quick recommendation for you");
      setOgContent("Hey {{first_name}},\n\nFound something that might help with {{pain_point}}.\n\nWhy I liked it:\n- {{benefit_1}}\n- {{benefit_2}}\n\nWorth checking out here: {{tracking_link}}\n\n— {{your_name}}");
      return;
    }
    setOgMethod("forum");
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
    <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#111416] shadow-2xl shadow-black/20">
        <div className="border-b border-white/10 px-7 py-6">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400/10">
              <Leaf className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                Submit Organic Promotion
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Share brand content or your own. No ad spend required.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-8 px-7 py-7">
          <div className="space-y-4">
            <StepHeader
              number={1}
              title="What are you sharing?"
              body="Use brand content for faster approval, or upload your own."
            />

            <div className="grid gap-4 md:grid-cols-2">
              <ChoiceCard
                active={!!usingBrandContent}
                title="Brand content"
                body="Use ready-to-go business content already linked to this offer."
                icon={<FileImage className="h-5 w-5 text-cyan-300" />}
                onClick={onSwitchToBrandContent}
              />
              <ChoiceCard
                active={!usingBrandContent}
                title="Upload my own"
                body="Create your own post, caption, and media for review."
                icon={<Upload className="h-5 w-5 text-zinc-400" />}
                onClick={onSwitchToUploadOwn}
              />
            </div>

            {usingBrandContent && selectedBrandCreative && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f10]">
                <div className="aspect-[4/3] bg-black">
                  {String(selectedBrandCreative.media_type).toLowerCase() === "video" ? (
                    <video
                      controls
                      className="h-full w-full object-cover"
                      poster={selectedBrandCreative.thumbnail_url || undefined}
                    >
                      <source src={selectedBrandCreative.media_url} />
                    </video>
                  ) : (
                    <img
                      src={selectedBrandCreative.media_url}
                      alt={selectedBrandCreative.title || "Selected brand creative"}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold text-white">
                    {selectedBrandCreative.title || "Selected brand creative"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {canLaunchInstantly
                      ? "This creative is pre-approved for organic use. Keep the provided caption to launch instantly."
                      : "This creative will be attached to your organic submission."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <StepHeader
              number={2}
              title="Tell us where you'll be sharing"
              body="This helps us provide the right guidance. You can share anywhere organically."
            />

            <label className="block">
              <span className="sr-only">Organic promotion method</span>
              <div className="relative">
                <select
                  value={ogMethod}
                  onChange={(e) => setOgMethod(e.target.value as typeof ogMethod)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-3 pr-10 text-sm text-zinc-200 outline-none transition focus:border-cyan-500/40"
                >
                  <option value="social">Social post</option>
                  <option value="email">Email campaign</option>
                  <option value="forum">Forum posting</option>
                  <option value="other">Other</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              </div>
            </label>

            {ogMethod === "social" ? (
              <>
                <div className="relative">
                  <select
                    value={ogPlatform}
                    onChange={(e) => setOgPlatform(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-3 pr-10 text-sm text-zinc-200 outline-none transition focus:border-cyan-500/40"
                  >
                    {SOCIAL_PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                  <MessageCircleMore className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300 opacity-0" />
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <PlatformPill active={ogPlatform === "Facebook"} label="Facebook" icon={<span className="text-[12px] font-bold">f</span>} onClick={() => setOgPlatform("Facebook")} />
                  <PlatformPill active={ogPlatform === "Instagram"} label="Instagram" icon={<Instagram className="h-3.5 w-3.5" />} onClick={() => setOgPlatform("Instagram")} />
                  <PlatformPill active={ogPlatform === "X (Twitter)"} label="X (Twitter)" icon={<Twitter className="h-3.5 w-3.5" />} onClick={() => setOgPlatform("X (Twitter)")} />
                  <PlatformPill active={ogPlatform === "TikTok"} label="TikTok" icon={<span className="text-[12px] font-bold">♪</span>} onClick={() => setOgPlatform("TikTok")} />
                  <PlatformPill active={ogPlatform === "YouTube"} label="YouTube" icon={<Youtube className="h-3.5 w-3.5" />} onClick={() => setOgPlatform("YouTube")} />
                  <PlatformPill active={ogPlatform === "Blog"} label="Blog" icon={<span className="text-[12px] font-bold">▤</span>} onClick={() => setOgPlatform("Blog")} />
                  <PlatformPill active={ogPlatform === "Other"} label="Other" icon={<span>•••</span>} onClick={() => setOgPlatform("Other")} />
                </div>
              </>
            ) : null}

            <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] p-4">
              <div className="flex gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    No platform restrictions
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-400">
                    Once approved, you can copy your unique tracking link and promote through
                    organic channels such as social media, forums, blogs, communities, email
                    and more.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <StepHeader
              number={3}
              title={ogMethod === "email" ? "Add your email copy" : ogMethod === "forum" ? "Add your forum copy" : "Add a caption (optional)"}
              body={
                ogMethod === "email"
                  ? "Write the subject line and body you plan to send."
                  : ogMethod === "forum"
                    ? "Add the community link plus the post copy you intend to publish."
                    : ogMethod === "other"
                      ? "Describe how you plan to introduce this offer to your audience."
                      : "Write your message or how you plan to introduce this to your audience."
              }
            />

            {ogMethod === "social" && (
              <div className="relative">
                <textarea
                  value={ogCaption}
                  onChange={(e) => setOgCaption(e.target.value)}
                  placeholder="Write your caption here..."
                  className="min-h-[120px] w-full resize-none rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-4 pr-16 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
                />
                <span className="absolute bottom-3 right-4 text-xs text-zinc-600">{ogCaption.length} / 500</span>
              </div>
            )}

            {ogMethod === "email" && (
              <div className="space-y-3">
                <input
                  value={ogCaption}
                  onChange={(e) => setOgCaption(e.target.value)}
                  placeholder="Subject line"
                  className="w-full rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
                />
                <textarea
                  rows={7}
                  value={ogContent}
                  onChange={(e) => setOgContent(e.target.value)}
                  placeholder="Write your email body here..."
                  className="min-h-[180px] w-full resize-none rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
                />
              </div>
            )}

            {ogMethod === "forum" && (
              <div className="space-y-3">
                <input
                  value={ogCaption}
                  onChange={(e) => setOgCaption(e.target.value)}
                  placeholder="Forum URL or title"
                  className="w-full rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
                />
                <textarea
                  rows={7}
                  value={ogContent}
                  onChange={(e) => setOgContent(e.target.value)}
                  placeholder="Write your forum post here..."
                  className="min-h-[180px] w-full resize-none rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
                />
              </div>
            )}

            {ogMethod === "other" && (
              <div className="space-y-3">
                <input
                  value={ogCaption}
                  onChange={(e) => setOgCaption(e.target.value)}
                  placeholder="Channel or summary"
                  className="w-full rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
                />
                <textarea
                  rows={7}
                  value={ogContent}
                  onChange={(e) => setOgContent(e.target.value)}
                  placeholder="Describe how and where this will be shared..."
                  className="min-h-[180px] w-full resize-none rounded-xl border border-white/10 bg-[#0c0f10] px-4 py-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
                />
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-3">
              <QuickButton onClick={() => applyTemplate("social")} label="Use social template" />
              <QuickButton onClick={() => applyTemplate("email")} label="Use email template" />
              <QuickButton onClick={() => applyTemplate("forum")} label="Use forum template" />
            </div>
          </div>

          <div className="space-y-4">
            <StepHeader
              number={4}
              title="Add media (optional)"
              body="Add an image or video to support your promotion."
            />

            <label className={`flex min-h-[115px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-6 text-center transition ${usingBrandContent ? "border-white/10 bg-[#0d1011] text-zinc-500" : "border-white/15 bg-[#0d1011] hover:border-cyan-500/30 hover:bg-[#101516]"}`}>
              <Upload className="mb-2 h-6 w-6 text-zinc-400" />
              <p className="text-sm font-medium text-zinc-200">
                {usingBrandContent ? "Brand content selected — upload disabled" : "Drag & drop a file here, or click to upload"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {ogFile ? ogFile.name : "MP4, MOV, JPG, PNG up to 50MB"}
              </p>
              <input
                type="file"
                accept="image/*,video/*"
                disabled={!!usingBrandContent}
                className="hidden"
                onChange={(e) => setOgFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <Disclosure title="Tips for a successful organic promotion">
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
              <li>Share the exact copy you’ll use.</li>
              <li>Include enough context for the business to approve quickly.</li>
              <li>Use Nettmark’s tracked link once approved.</li>
              <li>Keep claims accurate and aligned with the brand.</li>
            </ul>
          </Disclosure>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/10 px-7 py-5 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onSubmitClick}
            disabled={isSubmitting}
            className="rounded-xl bg-cyan-400 px-7 py-3 text-sm font-semibold text-[#051114] shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting…" : canLaunchInstantly ? "Launch Organic Campaign" : "Submit for Review"}
          </button>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-3xl border border-white/10 bg-[#111416] p-6">
          <h3 className="text-lg font-semibold text-white">What happens next?</h3>

          <div className="mt-6 space-y-6">
            <TimelineItem
              icon={<Send className="h-5 w-5 text-cyan-300" />}
              title={canLaunchInstantly ? "We'll create your campaign" : "We'll review your submission"}
              body={canLaunchInstantly ? "This brand content is already cleared for organic use." : "We'll check that your promotion follows the brand's guidelines."}
            />
            <TimelineItem
              icon={<Check className="h-5 w-5 text-cyan-300" />}
              title={canLaunchInstantly ? "You're ready to share" : "Get approved"}
              body={canLaunchInstantly ? "You’ll be able to use the live campaign and tracking path immediately." : "You'll get an email and in-app notification once it's approved."}
            />
            <TimelineItem
              icon={<Link2 className="h-5 w-5 text-cyan-300" />}
              title="Share your link"
              body="Copy your unique tracking link and start promoting through any organic channels."
              last
            />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#111416] p-6">
          <h3 className="text-lg font-semibold text-white">Preview</h3>

          <div className="mt-5 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-[10px] font-black text-black">
              NM
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{platformLabel}</p>
              <p className="text-xs text-zinc-500">Organic Promotion</p>
            </div>
          </div>

          <div className="mt-5 grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f10]">
            {previewMediaUrl ? (
              previewIsVideo ? (
                <video
                  controls
                  className="h-full w-full object-cover"
                  poster={usingBrandContent ? selectedBrandCreative?.thumbnail_url || undefined : undefined}
                >
                  <source src={previewMediaUrl} />
                </video>
              ) : (
                <img src={previewMediaUrl} alt="Organic preview" className="h-full w-full object-cover" />
              )
            ) : (
              <div className="text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-zinc-600" />
                <p className="mt-3 max-w-[190px] text-sm leading-5 text-zinc-500">
                  Your image or video preview will appear here
                </p>
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-white">Your copy</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-500">
              {captionLabel}
            </p>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex gap-3">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
              <p className="text-xs leading-5 text-zinc-500">
                {canLaunchInstantly
                  ? "Your unique tracking link will be available on the live campaign as soon as you launch."
                  : "Your unique tracking link will be generated after approval."}
              </p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function StepHeader({ number, title, body }: { number: number; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400 text-xs font-bold text-[#061114]">
        {number}
      </div>
      <div>
        <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{body}</p>
      </div>
    </div>
  );
}

function ChoiceCard({ active, title, body, icon, onClick }: { active?: boolean; title: string; body: string; icon: ReactNode; onClick?: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${active ? "border-cyan-500/40 bg-cyan-500/[0.06]" : "border-white/10 bg-[#0c0f10] hover:border-white/20"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${active ? "bg-cyan-400/10" : "bg-white/5"}`}>{icon}</div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">{title}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
        </div>
      </div>
    </button>
  );
}

function PlatformPill({ active, label, icon, onClick }: { active?: boolean; label: string; icon: ReactNode; onClick?: () => void; }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition ${active ? "border-cyan-500/40 bg-cyan-500/[0.08] text-cyan-200" : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TimelineItem({ icon, title, body, last = false }: { icon: ReactNode; title: string; body: string; last?: boolean }) {
  return (
    <div className="relative flex gap-3">
      <div className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-400/10">
        {icon}
      </div>
      {!last ? <div className="absolute left-5 top-10 h-[calc(100%-1rem)] w-px bg-white/10" /> : null}
      <div>
        <p className="text-sm font-semibold text-zinc-100">{title}</p>
        <p className="mt-1 text-sm leading-6 text-zinc-400">{body}</p>
      </div>
    </div>
  );
}

function QuickButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-white/10 bg-[#0c0f10] px-3 py-2 text-left text-xs text-zinc-300 transition hover:border-cyan-500/40 hover:bg-cyan-500/[0.04]"
    >
      {label}
    </button>
  );
}
