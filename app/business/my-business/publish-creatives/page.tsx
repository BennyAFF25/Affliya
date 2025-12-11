'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from 'utils/supabase/pages-client';
import { FiZap, FiBox, FiEdit3, FiUpload, FiUsers, FiMapPin, FiFolder, FiImage } from 'react-icons/fi';

const BusinessCreativesPage = () => {
  const session = useSession();
  const user = session?.user;
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState('');
  const [location, setLocation] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<'winning' | 'suggested'>('suggested');
  const [uploading, setUploading] = useState(false);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchCreatives = async () => {
      const { data, error } = await supabase
        .from('business_creatives')
        .select('*')
        .eq('business_email', user.email);

      if (!error && data) {
        setCreatives(data);
      }
    };

    const fetchData = async () => {
      const { data: offersData } = await supabase
        .from('offers')
        .select('*')
        .eq('business_email', user.email);
      setOffers(offersData || []);
    };

    fetchCreatives();
    fetchData();
  }, [user]);

  const handleUpload = async () => {
    if (!file || !user) return;

    console.log('[📤 Starting Upload]');
    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${uuidv4()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('business-creatives')
      .upload(filePath, file);

    if (uploadError) {
      console.error('[❌ Upload Error]', uploadError);
      setUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from('business-creatives')
      .getPublicUrl(filePath);

    console.log('[🌐 Public URL]', publicUrlData.publicUrl);

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
    console.log('[📦 Insert Payload]', insertPayload);
    const { error: insertError } = await supabase.from('business_creatives').insert([insertPayload]);

    if (insertError) {
      console.error('[❌ Insert Error]', insertError);
    } else {
      console.log('[✅ Insert Success]');
    }

    setCaption('');
    setAudience('');
    setLocation('');
    setFile(null);
    setUploading(false);

    const { data } = await supabase
      .from('business_creatives')
      .select('*')
      .eq('business_email', user.email);
    setCreatives(data || []);
    console.log('[🔁 Refetched Creatives]', data);
  };

  return (
    <div className="bg-[#0e0e0e] min-h-screen w-full p-10">
      <h1 className="text-2xl font-semibold text-[#00C2CB] mb-2 flex items-center gap-2">
        <FiImage className="text-[#00C2CB]" />
        Upload Creatives
      </h1>
      <p className="text-gray-400 text-sm mb-4">
        Upload creatives for your affiliates to use in campaigns.
      </p>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-[#00C2CB]/40 to-transparent my-4" />

      <div className="bg-[#1a1a1a] border border-[#00C2CB]/30 rounded-xl p-6 shadow-[0_0_10px_rgba(0,194,203,0.15)] backdrop-blur-sm space-y-4">
        <label className="text-white flex items-center gap-2 mb-2">
          <FiZap className="text-[#00C2CB]" />
          Creative Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'winning' | 'suggested')}
          className="w-full bg-[#0b0b0b]/80 border border-[#00C2CB]/30 rounded-md p-3 text-white focus:ring-2 focus:ring-[#00C2CB] focus:border-transparent transition duration-200 placeholder-gray-400"
        >
          <option value="winning">Winning Creative</option>
          <option value="suggested">Suggested Creative</option>
        </select>

        <label className="text-white flex items-center gap-2 mb-2">
          <FiBox className="text-[#00C2CB]" />
          Offer
        </label>
        <select
          value={selectedOfferId}
          onChange={(e) => setSelectedOfferId(e.target.value)}
          className="w-full bg-[#0b0b0b]/80 border border-[#00C2CB]/30 rounded-md p-3 text-white focus:ring-2 focus:ring-[#00C2CB] focus:border-transparent transition duration-200 placeholder-gray-400"
        >
          <option value="">Select Offer</option>
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.businessName} - {offer.title}
            </option>
          ))}
        </select>

        <label className="text-white flex items-center gap-2 mb-2">
          <FiEdit3 className="text-[#00C2CB]" />
          Caption
        </label>
        <input
          type="text"
          placeholder="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="w-full bg-[#0b0b0b]/80 border border-[#00C2CB]/30 rounded-md p-3 text-white focus:ring-2 focus:ring-[#00C2CB] focus:border-transparent transition duration-200 placeholder-gray-400"
        />

        {type === 'winning' && (
          <>
            <label className="text-white flex items-center gap-2 mb-2">
              <FiUsers className="text-[#00C2CB]" />
              Audience (e.g. Males 18-24)
            </label>
            <input
              type="text"
              placeholder="Audience (e.g. Males 18-24)"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full bg-[#0b0b0b]/80 border border-[#00C2CB]/30 rounded-md p-3 text-white focus:ring-2 focus:ring-[#00C2CB] focus:border-transparent transition duration-200 placeholder-gray-400"
            />
            <label className="text-white flex items-center gap-2 mb-2">
              <FiMapPin className="text-[#00C2CB]" />
              Location (e.g. Australia)
            </label>
            <input
              type="text"
              placeholder="Location (e.g. Australia)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#0b0b0b]/80 border border-[#00C2CB]/30 rounded-md p-3 text-white focus:ring-2 focus:ring-[#00C2CB] focus:border-transparent transition duration-200 placeholder-gray-400"
            />
          </>
        )}

        <label className="text-white flex items-center gap-2 mb-2">
          Media File
        </label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full bg-[#0b0b0b]/80 border border-[#00C2CB]/30 rounded-md p-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#00C2CB] focus:border-transparent transition duration-200 file:bg-[#00C2CB] file:text-black file:font-semibold file:border-none file:rounded file:px-4 file:py-2"
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-[#00C2CB] hover:bg-[#00b0b8] text-black font-semibold rounded-md py-3 transition-all duration-200 shadow-[0_0_10px_rgba(0,194,203,0.4)]"
        >
          <FiUpload className="text-black inline-block mr-2" />
          {uploading ? 'Uploading...' : 'Upload Creative'}
        </button>
      </div>

      <h2 className="text-2xl font-semibold text-[#00C2CB] mb-4 mt-12 flex items-center gap-2">
        <FiFolder className="text-[#00C2CB]" />
        Your Uploaded Creatives
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {creatives.map((creative) => (
          <div key={creative.id} className="bg-[#141414] border border-[#00C2CB]/30 rounded-xl p-4 shadow-md hover:shadow-[0_0_15px_rgba(0,194,203,0.3)] transition duration-200">
            <p className="font-semibold text-[#00C2CB] capitalize mb-1">📌 {creative.type}</p>
            <p className="text-sm text-gray-300 mb-2">{creative.caption}</p>
            {creative.audience && <p className="text-xs text-gray-400">🎯 {creative.audience}</p>}
            {creative.location && <p className="text-xs text-gray-400">🌍 {creative.location}</p>}
            {creative.media_url && (
              creative.media_url.includes('.mp4') ? (
                <video controls className="w-full rounded-lg mt-3 border border-[#00C2CB]/20">
                  <source src={creative.media_url} type="video/mp4" />
                </video>
              ) : (
                <img src={creative.media_url} alt="Creative" className="w-full rounded-lg mt-3 border border-[#00C2CB]/20" />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessCreativesPage;
