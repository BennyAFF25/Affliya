"use client";

import type { ReactNode } from "react";
import { isRenderableAssetUrl, type ContentLibraryAsset } from "@/../utils/contentLibrary";

interface BrandCreativePickerProps {
  mode: "ad" | "organic";
  assets: ContentLibraryAsset[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (asset: ContentLibraryAsset) => void;
  onChooseUploadOwn: () => void;
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex rounded-full border border-[#2a2a2a] bg-[#141414] px-2.5 py-1 text-[11px] text-gray-300">{children}</span>;
}

export function BrandCreativePicker({ mode, assets, loading, selectedId, onSelect, onChooseUploadOwn }: BrandCreativePickerProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#232323] bg-[#141414] p-5 text-sm text-gray-400">
        Loading brand content…
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[#232323] bg-[#141414] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[#00C2CB]">Brand content</h3>
          <p className="mt-1 text-sm text-gray-400">
            Choose ready-to-use creative approved for this offer, or switch back and upload your own.
          </p>
        </div>
        <button
          type="button"
          onClick={onChooseUploadOwn}
          className="rounded-xl border border-[#2a2a2a] px-3 py-2 text-xs font-medium text-gray-200 hover:border-[#00C2CB]/40"
        >
          Upload my own
        </button>
      </div>

      {assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#101010] p-5 text-sm text-gray-400">
          No brand content is available for this {mode === "ad" ? "paid" : "organic"} flow yet. You can still upload your own creative below.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assets.map((asset) => {
            const selected = selectedId === asset.id;
            const approvalLabel = mode === "ad" && asset.paid_preapproved ? "Paid pre-approved" : mode === "organic" && asset.organic_preapproved ? "Organic pre-approved" : "Final approval required";
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelect(asset)}
                className={[
                  "overflow-hidden rounded-2xl border text-left transition",
                  selected
                    ? "border-[#00C2CB] bg-[#0d1f21] shadow-[0_0_24px_rgba(0,194,203,0.16)]"
                    : "border-[#232323] bg-[#101010] hover:border-[#00C2CB]/35",
                ].join(" ")}
              >
                <div className="aspect-[4/3] bg-black">
                  {asset.media_type === "video" ? (
                    isRenderableAssetUrl(asset.media_url) ? (
                      <video className="h-full w-full object-cover" poster={isRenderableAssetUrl(asset.thumbnail_url) ? asset.thumbnail_url || undefined : undefined} muted playsInline>
                        <source src={asset.media_url} />
                      </video>
                    ) : (
                      <div className="flex h-full items-center justify-center px-5 text-center text-sm text-gray-400">Preview unavailable for this video asset.</div>
                    )
                  ) : (
                    isRenderableAssetUrl(asset.media_url) ? (
                      <img src={asset.media_url} alt={asset.title || "Brand creative"} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-5 text-center text-sm text-gray-400">Preview unavailable for this image asset.</div>
                    )
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <div className="text-base font-semibold text-white">{asset.title || "Untitled creative"}</div>
                    <div className="mt-1 text-sm text-gray-400 line-clamp-3">{asset.caption || "No suggested caption yet."}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{asset.media_type === "video" ? "Video" : "Image"}</Badge>
                    {asset.allow_organic && <Badge>Organic</Badge>}
                    {asset.allow_paid && <Badge>Paid ads</Badge>}
                    <Badge>{approvalLabel}</Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    {selected
                      ? "Selected"
                      : mode === "organic" && asset.organic_preapproved
                        ? "Use this creative to launch immediately"
                        : "Use this creative"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
