"use client";

import { useEffect, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "utils/supabase/pages-client";
import {
  FiZap,
  FiBox,
  FiEdit3,
  FiUpload,
  FiUsers,
  FiMapPin,
  FiFolder,
  FiImage,
} from "react-icons/fi";

const BusinessCreativesPage = () => {
  const session = useSession();
  const user = session?.user;
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState("");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<"winning" | "suggested">("suggested");
  const [uploading, setUploading] = useState(false);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchCreatives = async () => {
      const { data, error } = await supabase
        .from("business_creatives")
        .select("*")
        .eq("business_email", user.email);

      if (!error && data) {
        setCreatives(data);
      }
    };

    const fetchData = async () => {
      const { data: offersData } = await supabase
        .from("offers")
        .select("*")
        .eq("business_email", user.email);
      setOffers(offersData || []);
    };

    fetchCreatives();
    fetchData();
  }, [user]);

  const handleUpload = async () => {
    if (!file || !user) return;

    console.log("[📤 Starting Upload]");
    setUploading(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}_${uuidv4()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("business-creatives")
      .upload(filePath, file);

    if (uploadError) {
      console.error("[❌ Upload Error]", uploadError);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("business-creatives")
      .getPublicUrl(filePath);

    console.log("[🌐 Public URL]", publicUrlData.publicUrl);

    const insertPayload = {
      id: uuidv4(),
      business_email: user.email,
      offer_id: selectedOfferId || null,
      type,
      caption,
      audience,
      location,
      media_url: publicUrlData.publicUrl,
    };
    console.log("[📦 Insert Payload]", insertPayload);
    const { error: insertError } = await supabase
      .from("business_creatives")
      .insert([insertPayload]);

    if (insertError) {
      console.error("[❌ Insert Error]", insertError);
    } else {
      console.log("[✅ Insert Success]");
    }

    setCaption("");
    setAudience("");
    setLocation("");
    setFile(null);
    setUploading(false);

    const { data } = await supabase
      .from("business_creatives")
      .select("*")
      .eq("business_email", user.email);
    setCreatives(data || []);
    console.log("[🔁 Refetched Creatives]", data);
  };

  return (
    <div className="publish-creatives-theme min-h-screen w-full bg-[var(--background)] p-10">
      <h1 className="text-2xl font-semibold text-[var(--primary)] mb-2 flex items-center gap-2">
        <FiImage className="text-[var(--primary)]" />
        Upload Creatives
      </h1>
      <p className="text-[var(--muted-foreground)] text-sm mb-4">
        Upload creatives for your affiliates to use in campaigns.
      </p>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[var(--primary)]/40 to-transparent my-4" />

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_0_10px_rgba(0,0,0,0.10)] backdrop-blur-sm space-y-4">
        <label className="mb-2 flex items-center gap-2 text-[var(--foreground)]">
          <FiZap className="text-[var(--primary)]" />
          Creative Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "winning" | "suggested")}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] p-3 text-[var(--foreground)] transition duration-200 placeholder-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--ring)]"
        >
          <option value="winning">Winning Creative</option>
          <option value="suggested">Suggested Creative</option>
        </select>

        <label className="mb-2 flex items-center gap-2 text-[var(--foreground)]">
          <FiBox className="text-[var(--primary)]" />
          Offer
        </label>
        <select
          value={selectedOfferId}
          onChange={(e) => setSelectedOfferId(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] p-3 text-[var(--foreground)] transition duration-200 placeholder-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--ring)]"
        >
          <option value="">Select Offer</option>
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.businessName} - {offer.title}
            </option>
          ))}
        </select>

        <label className="mb-2 flex items-center gap-2 text-[var(--foreground)]">
          <FiEdit3 className="text-[var(--primary)]" />
          Caption
        </label>
        <input
          type="text"
          placeholder="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] p-3 text-[var(--foreground)] transition duration-200 placeholder-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--ring)]"
        />

        {type === "winning" && (
          <>
            <label className="mb-2 flex items-center gap-2 text-[var(--foreground)]">
              <FiUsers className="text-[var(--primary)]" />
              Audience (e.g. Males 18-24)
            </label>
            <input
              type="text"
              placeholder="Audience (e.g. Males 18-24)"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] p-3 text-[var(--foreground)] transition duration-200 placeholder-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--ring)]"
            />
            <label className="mb-2 flex items-center gap-2 text-[var(--foreground)]">
              <FiMapPin className="text-[var(--primary)]" />
              Location (e.g. Australia)
            </label>
            <input
              type="text"
              placeholder="Location (e.g. Australia)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--input-background)] p-3 text-[var(--foreground)] transition duration-200 placeholder-[var(--muted-foreground)] focus:border-transparent focus:ring-2 focus:ring-[var(--ring)]"
            />
          </>
        )}

        <label className="mb-2 flex items-center gap-2 text-[var(--foreground)]">
          Media File
        </label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full bg-[#0b0b0b]/80 border border-[#00C2CB]/30 rounded-md p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#00C2CB] focus:border-transparent transition duration-200 file:bg-[var(--primary)] file:text-[var(--primary-foreground)] file:font-semibold file:border-none file:rounded file:px-4 file:py-2"
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full rounded-md bg-[var(--primary)] py-3 font-semibold text-[var(--primary-foreground)] transition-all duration-200 hover:brightness-110 shadow-[0_0_10px_rgba(0,194,203,0.25)]"
        >
          <FiUpload className="mr-2 inline-block text-[var(--primary-foreground)]" />
          {uploading ? "Uploading..." : "Upload Creative"}
        </button>
      </div>

      <h2 className="text-2xl font-semibold text-[var(--primary)] mb-4 mt-12 flex items-center gap-2">
        <FiFolder className="text-[var(--primary)]" />
        Your Uploaded Creatives
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {creatives.map((creative) => (
          <div
            key={creative.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-md transition duration-200 hover:shadow-[0_0_15px_rgba(0,0,0,0.14)]"
          >
            <p className="font-semibold text-[var(--primary)] capitalize mb-1">
              📌 {creative.type}
            </p>
            <p className="mb-2 text-sm text-[var(--muted-foreground)]">
              {creative.caption}
            </p>
            {creative.audience && (
              <p className="text-xs text-[var(--muted-foreground)]">
                🎯 {creative.audience}
              </p>
            )}
            {creative.location && (
              <p className="text-xs text-[var(--muted-foreground)]">
                🌍 {creative.location}
              </p>
            )}
            {creative.media_url &&
              (creative.media_url.includes(".mp4") ? (
                <video
                  controls
                  className="w-full rounded-lg mt-3 border border-[var(--border)]"
                >
                  <source src={creative.media_url} type="video/mp4" />
                </video>
              ) : (
                <img
                  src={creative.media_url}
                  alt="Creative"
                  className="w-full rounded-lg mt-3 border border-[var(--border)]"
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessCreativesPage;
