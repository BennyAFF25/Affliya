"use client";

import { useEffect, useMemo } from "react";
import { INPUT } from "../constants";
import { AdFormState } from "../types";

interface PreviewSidebarProps {
  mode: 'ad' | 'organic';
  reachDaily: number | null;
  reachMonthly: number | null;
  interestsIgnored: boolean;
  dailyConversions: number | null;
  monthlyConversions: number | null;
  brandName: string;
  brandLogoUrl: string | null;
  videoPreviewUrl: string | null;
  thumbPreviewUrl: string | null;
  form: AdFormState;
  ogMethod: 'social' | 'email' | 'forum' | 'other';
  ogFile: File | null;
  ogPlatform: string;
  ogCaption: string;
}

export function PreviewSidebar(props: PreviewSidebarProps) {
  const {
    mode,
    reachDaily,
    reachMonthly,
    interestsIgnored,
    dailyConversions,
    monthlyConversions,
    brandName,
    brandLogoUrl,
    videoPreviewUrl,
    thumbPreviewUrl,
    form,
    ogMethod,
    ogFile,
    ogPlatform,
    ogCaption,
  } = props;

  const socialPreviewUrl = useMemo(() => {
    if (!ogFile) return null;
    return URL.createObjectURL(ogFile);
  }, [ogFile]);

  useEffect(() => {
    return () => {
      if (socialPreviewUrl) URL.revokeObjectURL(socialPreviewUrl);
    };
  }, [socialPreviewUrl]);

  return (
    <aside className="space-y-6">
      {mode === 'ad' && (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 sm:p-6">
          <div className="text-[#00C2CB] font-semibold text-base sm:text-lg mb-2">Estimated Reach</div>
          <div className="flex items-center gap-8">
            <div>
              <div className="text-[11px] text-gray-400">Daily</div>
              <div className="text-2xl font-extrabold text-[#00C2CB]">{reachDaily !== null ? reachDaily.toLocaleString() : '—'}</div>
            </div>
            <div>
              <div className="text-[11px] text-gray-400">Monthly</div>
              <div className="text-2xl font-extrabold text-[#00C2CB]">{reachMonthly !== null ? reachMonthly.toLocaleString() : '—'}</div>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Estimated unique users based on your ad set targeting.
            {interestsIgnored && (
              <span className="block mt-1 text-[11px] text-gray-500">Some typed interests were ignored because they didn’t match official Meta interest IDs.</span>
            )}
          </div>
        </div>
      )}

      {mode === 'ad' && (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 sm:p-6">
          <div className="text-[#00C2CB] font-semibold text-base sm:text-lg mb-3">Estimated Conversions</div>
          <div className="flex gap-8 items-end">
            <div>
              <div className="text-[11px] text-gray-400">Daily</div>
              <div className="text-2xl font-extrabold text-[#00C2CB]">
                {Number.isFinite(dailyConversions) ? Math.floor(dailyConversions || 0).toLocaleString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-gray-400">Monthly</div>
              <div className="text-2xl font-extrabold text-[#00C2CB]">
                {Number.isFinite(monthlyConversions) ? Math.floor(monthlyConversions || 0).toLocaleString() : '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'ad' && (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt={brandName} className="h-8 w-8 rounded-full object-cover border border-[#2a2a2a]" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#2a2a2a]" />
            )}
            <div>
              <div className="text-sm font-semibold">{brandName}</div>
              <div className="text-xs text-gray-400">Sponsored</div>
            </div>
          </div>

          <div className="aspect-[4/5] w-full rounded-lg bg-[#0f0f0f] border border-[#232323] overflow-hidden">
            {videoPreviewUrl ? (
              <video src={videoPreviewUrl} className="h-full w-full object-cover" controls playsInline muted />
            ) : thumbPreviewUrl ? (
              <img src={thumbPreviewUrl} alt="Thumbnail preview" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">Your ad image/video will appear here</div>
            )}
          </div>

          <div className="mt-3">
            <div className="font-semibold">{form.headline || 'Your headline will appear here'}</div>
            <div className="text-sm text-gray-400">{form.caption || 'Your ad description will appear here. Make it compelling!'}</div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-gray-500">{form.display_link || 'yourdomain.com'}</div>
              <button className="px-4 py-2 rounded-lg bg-[#00C2CB] text-black text-sm font-semibold">
                {form.call_to_action.replace('_', ' ') || 'Learn More'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === 'organic' && ogMethod === 'social' && (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-3">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt={brandName} className="h-8 w-8 rounded-full object-cover border border-[#2a2a2a]" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#2a2a2a]" />
            )}
            <div>
              <div className="text-sm font-semibold">{brandName}</div>
              <div className="text-xs text-gray-400">Organic Preview</div>
            </div>
          </div>

          <div className="aspect-[4/5] w-full rounded-lg bg-[#0f0f0f] border border-[#232323] overflow-hidden">
            {socialPreviewUrl && ogFile?.type.startsWith('video/') ? (
              <video src={socialPreviewUrl} className="h-full w-full object-cover" controls playsInline muted />
            ) : socialPreviewUrl && ogFile?.type.startsWith('image/') ? (
              <img src={socialPreviewUrl} alt="Organic media preview" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-500 text-sm">Your social media image/video will appear here</div>
            )}
          </div>

          <div className="mt-3">
            <div className="font-semibold">{ogPlatform}</div>
            <div className="text-sm text-gray-400 whitespace-pre-wrap">{ogCaption || 'Write your caption to preview it here.'}</div>
          </div>
        </div>
      )}
    </aside>
  );
}
