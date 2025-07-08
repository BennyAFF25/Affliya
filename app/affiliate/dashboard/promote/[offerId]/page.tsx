'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { supabase } from '@/../utils/supabase/pages-client';
import { useSession } from '@supabase/auth-helpers-react';

export default function PromoteOfferPage() {
  const router = useRouter();
  const params = useParams();
  const offerId = params.offerId as string;
  const session = useSession();
  const userEmail = session?.user?.email || '';

  const [formData, setFormData] = useState({
    headline: '',
    caption: '',
    description: '',
    display_link: '',
    thumbnail_url: '',
    call_to_action: 'LEARN_MORE',
    objective: 'OUTCOME_TRAFFIC',
    budget_amount: 1000,
    budget_type: 'DAILY',
    start_time: '',
    end_time: '',
    audience: '',
    location: '',
    age_range: '',
    gender: '',
    interests: '',
    campaign_name: '',
    special_ad_category: '',
    ad_set_name: '',
    conversion_location: '',
    dataset_id: '',
    conversion_event: '',
    performance_goal: '',
    placements_type: '',
    ad_name: '',
    page_id: '',
    instagram_id: '',
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [mediaType, setMediaType] = useState<'VIDEO' | 'IMAGE'>('VIDEO');

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'thumbnail') => {
    const file = e.target.files?.[0];
    if (type === 'video') setVideoFile(file || null);
    else setThumbnailFile(file || null);
  };

  const uploadToSupabase = async (file: File, folder: string) => {
    const filePath = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('ad-ideas-assets')
      .upload(`${folder}/${filePath}`, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw new Error(error.message);

    const publicUrl = supabase.storage.from('ad-ideas-assets').getPublicUrl(`${folder}/${filePath}`);
    return publicUrl.data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!videoFile || !thumbnailFile) {
      alert(`Upload ${mediaType === 'VIDEO' ? 'video' : 'image'} and a thumbnail file`);
      return;
    }

    setLoading(true);
    try {
      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('business_email')
        .eq('id', offerId)
        .single();

      if (offerError || !offerData) {
        throw new Error('Failed to fetch offer data');
      }

      const video_url = await uploadToSupabase(videoFile, 'videos');
      const thumbnail_url = await uploadToSupabase(thumbnailFile, 'thumbnails');
      formData.thumbnail_url = thumbnail_url;

      const { error } = await supabase.from('ad_ideas').insert({
        headline: formData.headline,
        caption: formData.caption,
        description: formData.description,
        display_link: formData.display_link,
        call_to_action: formData.call_to_action,
        objective: formData.objective,
        budget_amount: Number(formData.budget_amount),
        budget_type: formData.budget_type,
        start_time: formData.start_time,
        end_time: formData.end_time,
        audience: formData.audience,
        location: formData.location,
        age_range: `{${formData.age_range}}`,
        gender: formData.gender,
        interests: formData.interests,
        media_type: mediaType,
        file_url: video_url,
        thumbnail_url: formData.thumbnail_url,
        status: 'pending',
        campaign_name: formData.campaign_name,
        special_ad_category: formData.special_ad_category,
        ad_set_name: formData.ad_set_name,
        conversion_location: formData.conversion_location,
        dataset_id: formData.dataset_id,
        conversion_event: formData.conversion_event,
        performance_goal: formData.performance_goal,
        placements_type: formData.placements_type,
        ad_name: formData.ad_name,
        page_id: formData.page_id,
        instagram_id: formData.instagram_id,
        affiliate_email: userEmail,
        business_email: offerData.business_email,
        offer_id: offerId,
      });

      if (error) throw new Error(error.message);

      alert('Ad idea submitted!');
      router.refresh();
    } catch (err) {
      console.error('[❌ Submit Error]', err);
      alert('Failed to submit ad idea.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold text-[#00C2CB] mb-4">Submit Your Ad Idea</h1>

      <input name="headline" onChange={handleInput} value={formData.headline} placeholder="Headline" className="w-full border p-2 rounded" />
      <textarea name="caption" onChange={handleInput} value={formData.caption} placeholder="Caption" className="w-full border p-2 rounded" />
      <textarea name="description" onChange={handleInput} value={formData.description} placeholder="Description" className="w-full border p-2 rounded" />
      <input name="display_link" onChange={handleInput} value={formData.display_link} placeholder="Destination Link" className="w-full border p-2 rounded" />

      <select name="call_to_action" onChange={handleInput} value={formData.call_to_action} className="w-full border p-2 rounded">
        <option value="LEARN_MORE">Learn More</option>
        <option value="SHOP_NOW">Shop Now</option>
        <option value="SIGN_UP">Sign Up</option>
      </select>
      <select name="objective" onChange={handleInput} value={formData.objective} className="w-full border p-2 rounded">
        <option value="OUTCOME_AWARENESS">Awareness</option>
        <option value="OUTCOME_TRAFFIC">Traffic</option>
        <option value="OUTCOME_ENGAGEMENT">Engagement</option>
        <option value="OUTCOME_LEADS">Leads</option>
        <option value="OUTCOME_SALES">Sales</option>
        <option value="OUTCOME_APP_PROMOTION">App Promotion</option>
        <option value="OUTCOME_LOCAL_AWARENESS">Local Awareness</option>
        <option value="OUTCOME_VIDEO_VIEWS">Video Views</option>
        <option value="OUTCOME_REACH">Reach</option>
        <option value="OUTCOME_MESSAGES">Messages</option>
        <option value="OUTCOME_STORE_TRAFFIC">Store Traffic</option>
      </select>

      <input name="budget_amount" onChange={handleInput} value={formData.budget_amount} placeholder="Budget Amount" type="number" className="w-full border p-2 rounded" />
      <select name="budget_type" onChange={handleInput} value={formData.budget_type} className="w-full border p-2 rounded">
        <option value="DAILY">Daily</option>
        <option value="LIFETIME">Lifetime</option>
      </select>

      <input name="start_time" onChange={handleInput} value={formData.start_time} placeholder="Start DateTime" type="datetime-local" className="w-full border p-2 rounded" />
      <input name="end_time" onChange={handleInput} value={formData.end_time} placeholder="End DateTime" type="datetime-local" className="w-full border p-2 rounded" />

      <input name="audience" onChange={handleInput} value={formData.audience} placeholder="Audience" className="w-full border p-2 rounded" />
      <input name="location" onChange={handleInput} value={formData.location} placeholder="Location" className="w-full border p-2 rounded" />
      <input name="age_range" onChange={handleInput} value={formData.age_range} placeholder="Age Range (e.g., 25-35)" className="w-full border p-2 rounded" />
      <input name="gender" onChange={handleInput} value={formData.gender} placeholder="Gender" className="w-full border p-2 rounded" />
      <input name="interests" onChange={handleInput} value={formData.interests} placeholder="Interests" className="w-full border p-2 rounded" />

      <div className="w-full border p-2 rounded">
        <label className="block font-semibold mb-1">Ad Media Type</label>
        <select
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value as 'VIDEO' | 'IMAGE')}
          className="w-full border p-2 rounded"
        >
          <option value="VIDEO">Video</option>
          <option value="IMAGE">Image</option>
        </select>
      </div>

      {mediaType === 'VIDEO' ? (
        <>
          <label className="block mt-4">Upload Video</label>
          <input type="file" accept="video/mp4" onChange={(e) => handleFileChange(e, 'video')} className="w-full border p-2 rounded" />
        </>
      ) : (
        <>
          <label className="block mt-4">Upload Image</label>
          <input type="file" accept="image/jpeg,image/png" onChange={(e) => handleFileChange(e, 'video')} className="w-full border p-2 rounded" />
        </>
      )}

      <label className="block mt-4">Upload Thumbnail</label>
      <input type="file" accept="image/jpeg,image/png" onChange={(e) => handleFileChange(e, 'thumbnail')} className="w-full border p-2 rounded" />

      <input name="campaign_name" onChange={handleInput} value={formData.campaign_name} placeholder="Campaign Name" className="w-full border p-2 rounded" />
      <input name="special_ad_category" onChange={handleInput} value={formData.special_ad_category} placeholder="Special Ad Category (e.g. NONE)" className="w-full border p-2 rounded" />
      <input name="ad_set_name" onChange={handleInput} value={formData.ad_set_name} placeholder="Ad Set Name" className="w-full border p-2 rounded" />
      <input name="conversion_location" onChange={handleInput} value={formData.conversion_location} placeholder="Conversion Location (e.g. WEBSITE)" className="w-full border p-2 rounded" />
      <input name="dataset_id" onChange={handleInput} value={formData.dataset_id} placeholder="Dataset / Pixel ID" className="w-full border p-2 rounded" />
      <input name="conversion_event" onChange={handleInput} value={formData.conversion_event} placeholder="Conversion Event" className="w-full border p-2 rounded" />
      <input name="performance_goal" onChange={handleInput} value={formData.performance_goal} placeholder="Performance Goal" className="w-full border p-2 rounded" />
      <input name="placements_type" onChange={handleInput} value={formData.placements_type} placeholder="Placements Type (e.g. AUTO)" className="w-full border p-2 rounded" />
      <input name="ad_name" onChange={handleInput} value={formData.ad_name} placeholder="Ad Name" className="w-full border p-2 rounded" />
      <input name="page_id" onChange={handleInput} value={formData.page_id} placeholder="Facebook Page ID" className="w-full border p-2 rounded" />
      <input name="instagram_id" onChange={handleInput} value={formData.instagram_id} placeholder="Instagram Account ID" className="w-full border p-2 rounded" />

      <button
        disabled={loading}
        onClick={handleSubmit}
        className="bg-[#00C2CB] w-full text-white py-2 rounded hover:bg-[#00b0b8] disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Ad Idea'}
      </button>
    </div>
  );
}