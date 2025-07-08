'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from 'utils/supabase/pages-client';

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
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-[#00C2CB] mb-6">Upload Creatives</h1>

      <div className="grid grid-cols-1 gap-4 mb-10">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'winning' | 'suggested')}
          className="border border-gray-300 p-2 rounded"
        >
          <option value="winning">Winning Creative</option>
          <option value="suggested">Suggested Creative</option>
        </select>

        <select
          value={selectedOfferId}
          onChange={(e) => setSelectedOfferId(e.target.value)}
          className="border border-gray-300 p-2 rounded"
        >
          <option value="">Select Offer</option>
          {offers.map((offer) => (
            <option key={offer.id} value={offer.id}>
              {offer.businessName} - {offer.title}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="border border-gray-300 p-2 rounded"
        />

        {type === 'winning' && (
          <>
            <input
              type="text"
              placeholder="Audience (e.g. Males 18-24)"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="border border-gray-300 p-2 rounded"
            />
            <input
              type="text"
              placeholder="Location (e.g. Australia)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="border border-gray-300 p-2 rounded"
            />
          </>
        )}

        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="border border-gray-300 p-2 rounded"
        />

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="bg-[#00C2CB] text-white font-semibold px-4 py-2 rounded"
        >
          {uploading ? 'Uploading...' : 'Upload Creative'}
        </button>
      </div>

      <h2 className="text-xl font-semibold text-[#00C2CB] mb-4">Your Uploaded Creatives</h2>
      <div className="grid grid-cols-1 gap-4">
        {creatives.map((creative) => (
          <div key={creative.id} className="border p-4 rounded shadow-sm">
            <p className="font-bold text-[#00C2CB] capitalize">{creative.type}</p>
            <p className="text-sm text-gray-600 mb-2">{creative.caption}</p>
            {creative.audience && (
              <p className="text-xs text-gray-500">Audience: {creative.audience}</p>
            )}
            {creative.location && (
              <p className="text-xs text-gray-500">Location: {creative.location}</p>
            )}
            {creative.media_url && (
              creative.media_url.includes('.mp4') ? (
                <video controls className="w-full rounded mt-2">
                  <source src={creative.media_url} type="video/mp4" />
                </video>
              ) : (
                <img src={creative.media_url} alt="Creative" className="w-full rounded mt-2" />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessCreativesPage;
