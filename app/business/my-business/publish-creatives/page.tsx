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
      <h1 className="text-3xl font-bold text-[#00C2CB] mb-8 flex items-center gap-2">
        <FiImage className="text-[#00C2CB]" />
        Upload Creatives
      </h1>

      <div className="bg-[#1f1f1f] p-6 rounded-lg shadow-md border border-[#00C2CB] mb-10 space-y-4">
        <label className="text-white flex items-center gap-2 mb-2">
          <FiZap className="text-[#00C2CB]" />
          Creative Type
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'winning' | 'suggested')}
          className="bg-black text-white border border-gray-600 p-3 rounded w-full"
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
          className="bg-black text-white border border-gray-600 p-3 rounded w-full"
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
          className="bg-black text-white border border-gray-600 p-3 rounded w-full"
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
              className="bg-black text-white border border-gray-600 p-3 rounded w-full"
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
              className="bg-black text-white border border-gray-600 p-3 rounded w-full"
            />
          </>
        )}

        <label className="text-white flex items-center gap-2 mb-2">
          Media File
        </label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="bg-black text-[#00C2CB] placeholder-gray-400 border border-gray-600 p-3 rounded w-full file:bg-[#00C2CB] file:text-black file:font-semibold file:border-none file:rounded file:px-4 file:py-2"
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white font-semibold px-6 py-3 rounded w-full flex items-center justify-center gap-2 transition duration-200"
        >
          <FiUpload className="text-white" />
          {uploading ? 'Uploading...' : 'Upload Creative'}
        </button>
      </div>

      <h2 className="text-2xl font-semibold text-[#00C2CB] mb-4 flex items-center gap-2">
        <FiFolder className="text-[#00C2CB]" />
        Your Uploaded Creatives
      </h2>
      <div className="grid grid-cols-1 gap-4">
        {creatives.map((creative) => (
          <div key={creative.id} className="bg-[#1f1f1f] p-4 rounded-lg shadow-md border border-gray-700">
            <p className="font-bold text-[#00C2CB] capitalize mb-1">📌 {creative.type}</p>
            <p className="text-sm text-gray-300 mb-2">{creative.caption}</p>
            {creative.audience && (
              <p className="text-xs text-gray-400">🎯 Audience: {creative.audience}</p>
            )}
            {creative.location && (
              <p className="text-xs text-gray-400">🌍 Location: {creative.location}</p>
            )}
            {creative.media_url && (
              creative.media_url.includes('.mp4') ? (
                <video controls className="w-full rounded mt-3 border border-gray-700">
                  <source src={creative.media_url} type="video/mp4" />
                </video>
              ) : (
                <img src={creative.media_url} alt="Creative" className="w-full rounded mt-3 border border-gray-700" />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessCreativesPage;
