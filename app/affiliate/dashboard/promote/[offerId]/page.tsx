'use client';

import { useState, useEffect } from 'react';
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

  // Redirect unauthenticated users to '/' (prevent looping)
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      router.push('/');
    }
  }, [session, router]);

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
    platform: '',
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [organicFile, setOrganicFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [mediaType, setMediaType] = useState<'VIDEO' | 'IMAGE'>('VIDEO');
  const [activeTab, setActiveTab] = useState<'ad' | 'organic'>('ad');
  // Step state for ad idea submission
  const [step, setStep] = useState(1);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'thumbnail' | 'organic') => {
    const file = e.target.files?.[0];
    if (type === 'video') setVideoFile(file || null);
    else if (type === 'thumbnail') setThumbnailFile(file || null);
    else if (type === 'organic') setOrganicFile(file || null);
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

  const handleUpload = async () => {
    if (!organicFile) {
      alert('Please upload an image or video file.');
      return;
    }

    setLoading(true);
    try {
      const filePath = `${Date.now()}_${organicFile.name}`;
      const { data, error } = await supabase.storage
        .from('organic-posts')
        .upload(filePath, organicFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw new Error(error.message);

      const publicUrl = supabase.storage.from('organic-posts').getPublicUrl(filePath).data.publicUrl;

      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('business_email')
        .eq('id', offerId)
        .single();

      if (offerError || !offerData) throw new Error('Failed to fetch offer');

      const isVideo = organicFile.type.startsWith('video');
      const insertPayload = {
        platform: formData.platform,
        caption: formData.caption,
        affiliate_email: userEmail,
        business_email: offerData.business_email,
        offer_id: offerId,
        status: 'pending',
        image_url: isVideo ? null : publicUrl,
        video_url: isVideo ? publicUrl : null,
        user_id: session?.user?.id || ''
      };
      const { error: insertError } = await supabase.from('organic_posts').insert(insertPayload);

      if (insertError) throw new Error(insertError.message);

      alert('Organic post submitted!');
      router.refresh();
    } catch (err) {
      console.error('[❌ Organic Upload Error]', err);
      alert('Failed to upload organic post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white py-12 px-6">
      {/* Centered tab buttons */}
      <div className="flex justify-center gap-4 mb-4">
        <button
          onClick={() => setActiveTab('ad')}
          className={`px-4 py-2 rounded ${activeTab === 'ad' ? 'bg-[#00C2CB] text-white' : 'bg-white border text-[#00C2CB]'}`}
        >
          Submit Ad Idea
        </button>
        <button
          onClick={() => setActiveTab('organic')}
          className={`px-4 py-2 rounded ${activeTab === 'organic' ? 'bg-[#00C2CB] text-white' : 'bg-white border text-[#00C2CB]'}`}
        >
          Submit Organic Post
        </button>
      </div>

      {activeTab === 'ad' && (
        <div className="flex justify-center items-start gap-12 mt-10">
          {/* Left: Stepper Form */}
          <div className="flex-1 max-w-2xl">
            <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
              <h1 className="text-2xl font-bold text-[#00C2CB] mb-4">Submit Your Ad Idea</h1>
              {/* Stepper indicator */}
              <div className="flex items-center mb-6 space-x-2 text-xs font-medium">
                {['Basic Info', 'Objective & Budget', 'Targeting', 'Media', 'Ad Details'].map((label, idx) => (
                  <div key={label} className="flex items-center">
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full 
    ${step === idx+1 ? 'bg-[#00C2CB] text-white' : 'bg-gray-200 text-gray-600'}`}>
                      {idx+1}
                    </div>
                    {idx < 4 && <div className="w-8 h-0.5 bg-gray-300 mx-1"></div>}
                  </div>
                ))}
              </div>
              {/* Step content */}
              {step === 1 && (
                <div className="space-y-3">
                  <input name="headline" onChange={handleInput} value={formData.headline} placeholder="Headline" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <textarea name="caption" onChange={handleInput} value={formData.caption} placeholder="Caption" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <textarea name="description" onChange={handleInput} value={formData.description} placeholder="Description" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="display_link" onChange={handleInput} value={formData.display_link} placeholder="Destination Link" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                </div>
              )}
              {step === 2 && (
                <div className="space-y-3">
                  <select name="objective" onChange={handleInput} value={formData.objective} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded">
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
                  <select name="call_to_action" onChange={handleInput} value={formData.call_to_action} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded">
                    <option value="LEARN_MORE">Learn More</option>
                    <option value="SHOP_NOW">Shop Now</option>
                    <option value="SIGN_UP">Sign Up</option>
                  </select>
                  <input name="budget_amount" onChange={handleInput} value={formData.budget_amount} placeholder="Budget Amount" type="number" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <select name="budget_type" onChange={handleInput} value={formData.budget_type} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded">
                    <option value="DAILY">Daily</option>
                    <option value="LIFETIME">Lifetime</option>
                  </select>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-3">
                  <input name="start_time" onChange={handleInput} value={formData.start_time} placeholder="Start DateTime" type="datetime-local" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="end_time" onChange={handleInput} value={formData.end_time} placeholder="End DateTime" type="datetime-local" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="audience" onChange={handleInput} value={formData.audience} placeholder="Audience" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="location" onChange={handleInput} value={formData.location} placeholder="Location" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="age_range" onChange={handleInput} value={formData.age_range} placeholder="Age Range (e.g., 25-35)" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="gender" onChange={handleInput} value={formData.gender} placeholder="Gender" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="interests" onChange={handleInput} value={formData.interests} placeholder="Interests" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                </div>
              )}
              {step === 4 && (
                <div className="flex flex-col md:flex-row gap-10 items-start w-full mt-6">
                  {/* Upload Card */}
                  <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-xl">
                    <h3 className="text-lg font-semibold text-[#00C2CB] mb-4">Step 4: Upload Media</h3>

                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad Media Type</label>
                    <select
                      className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full mb-4 border rounded-md p-2"
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value as 'VIDEO' | 'IMAGE')}
                    >
                      <option value="VIDEO">Video</option>
                      <option value="IMAGE">Image</option>
                      <option value="CAROUSEL">Carousel</option>
                    </select>

                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {mediaType === 'VIDEO' ? 'Upload Video' : mediaType === 'IMAGE' ? 'Upload Image' : 'Upload Video/Image'}
                    </label>
                    <input
                      type="file"
                      accept={mediaType === 'VIDEO' ? 'video/*' : mediaType === 'IMAGE' ? 'image/*' : 'video/*,image/*'}
                      onChange={(e) => handleFileChange(e, 'video')}
                      className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full mb-4 border p-2 rounded-md"
                    />

                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Thumbnail</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, 'thumbnail')}
                      className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full mb-4 border p-2 rounded-md"
                    />

                    <div className="flex justify-between mt-4">
                      <button
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
                        onClick={() => setStep((s) => Math.max(1, s - 1))}
                        type="button"
                      >
                        Back
                      </button>
                      <button
                        className="px-4 py-2 bg-[#00C2CB] text-white rounded hover:bg-[#00b0b8]"
                        onClick={() => setStep((s) => Math.min(5, s + 1))}
                        type="button"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {/* Preview Card */}
                  <div className="bg-white rounded-md shadow-md border border-gray-100 p-6 max-w-sm w-full">
                    <div className="w-full h-48 bg-gray-100 rounded mb-4 flex items-center justify-center text-gray-400">
                      Thumbnail preview
                    </div>
                    <div className="w-full mt-4">
                      <h3 className="text-lg font-semibold w-full">Ad Headline Preview</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Ad caption preview…</p>
                    <p className="text-sm text-[#00C2CB] hover:underline cursor-pointer">LEARN MORE</p>
                  </div>
                </div>
              )}
              {step === 5 && (
                <div className="space-y-3">
                  <input name="campaign_name" onChange={handleInput} value={formData.campaign_name} placeholder="Campaign Name" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  {/* Special Ad Category dropdown */}
                  <select name="special_ad_category" onChange={handleInput} value={formData.special_ad_category} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded form-input">
                    <option value="">Select Special Ad Category</option>
                    <option value="NONE">NONE</option>
                    <option value="EMPLOYMENT">EMPLOYMENT</option>
                    <option value="HOUSING">HOUSING</option>
                    <option value="CREDIT">CREDIT</option>
                    <option value="POLITICAL">POLITICAL</option>
                  </select>
                  <input name="ad_set_name" onChange={handleInput} value={formData.ad_set_name} placeholder="Ad Set Name" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  {/* Conversion Location dropdown */}
                  <select name="conversion_location" onChange={handleInput} value={formData.conversion_location} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded form-input">
                    <option value="">Select Conversion Location</option>
                    <option value="WEBSITE">Website</option>
                    <option value="APP">App</option>
                    <option value="MESSENGER">Messenger</option>
                  </select>
                  <input name="dataset_id" onChange={handleInput} value={formData.dataset_id} placeholder="Dataset / Pixel ID" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="conversion_event" onChange={handleInput} value={formData.conversion_event} placeholder="Conversion Event" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  {/* Performance Goal dropdown */}
                  <select name="performance_goal" onChange={handleInput} value={formData.performance_goal} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded form-input">
                    <option value="">Select Performance Goal</option>
                    <option value="REACH">Reach</option>
                    <option value="LINK_CLICKS">Link Clicks</option>
                    <option value="CONVERSIONS">Conversions</option>
                    <option value="LEAD_GENERATION">Lead Generation</option>
                  </select>
                  {/* Placements Type dropdown */}
                  <select name="placements_type" onChange={handleInput} value={formData.placements_type} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded form-input">
                    <option value="">Select Placements Type</option>
                    <option value="AUTO">Automatic</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                  <input name="ad_name" onChange={handleInput} value={formData.ad_name} placeholder="Ad Name" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="page_id" onChange={handleInput} value={formData.page_id} placeholder="Facebook Page ID" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                  <input name="instagram_id" onChange={handleInput} value={formData.instagram_id} placeholder="Instagram Account ID" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded" />
                </div>
              )}
              {/* Navigation Buttons */}
              <div className="w-full h-[1px] bg-gray-100 my-6" />
              <div className="flex justify-center gap-4 mt-6">
                <button
                  className="px-6 py-2 rounded border text-[#00C2CB] disabled:opacity-50 min-w-[96px]"
                  disabled={step === 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                >
                  Back
                </button>
                {step < 5 ? (
                  <button
                    className="px-6 py-2 rounded bg-[#00C2CB] text-white hover:bg-[#00b0b8] min-w-[96px]"
                    onClick={() => setStep((s) => Math.min(5, s + 1))}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    disabled={loading}
                    onClick={handleSubmit}
                    className="px-6 py-2 rounded bg-[#00C2CB] text-white hover:bg-[#00b0b8] disabled:opacity-50 min-w-[96px]"
                  >
                    {loading ? 'Submitting...' : 'Submit Ad Idea'}
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Right: Sticky Preview */}
          <div className="hidden lg:block w-96">
            <div className="sticky top-24">
              <div className="bg-white rounded-md shadow-md border border-gray-100 p-6 max-w-sm w-full">
                <div className="w-full h-48 bg-gray-100 rounded mb-4 flex items-center justify-center text-gray-400">
                  Thumbnail preview
                </div>
                <div className="w-full mt-4">
                  <h3 className="text-lg font-semibold w-full">{formData.headline || 'Ad Headline Preview'}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">{formData.caption || 'Ad caption preview…'}</p>
                <p className="text-sm text-[#00C2CB] hover:underline cursor-pointer">{formData.call_to_action.replace('_', ' ').toUpperCase() || 'LEARN MORE'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'organic' && (
        <div className="max-w-2xl">
          <div className="w-full h-[1px] bg-gray-100 my-6" />
          <h2 className="text-xl font-bold text-[#00C2CB] mb-2">Submit Organic Post</h2>
          <select name="platform" onChange={handleInput} value={formData.platform || ''} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded">
            <option value="">Select Platform</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
          <input name="caption" onChange={handleInput} value={formData.caption} placeholder="Caption" className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded mt-2" />
          <input type="file" accept="image/*,video/*" onChange={(e) => handleFileChange(e, 'organic')} className="transition-all duration-200 focus:ring-[#00C2CB] focus:border-[#00C2CB] w-full border p-2 rounded mt-2" />
          <button
            disabled={loading}
            onClick={handleUpload}
            className="bg-[#00C2CB] w-full text-white py-2 rounded hover:bg-[#00b0b8] mt-2 disabled:opacity-50"
          >
            {loading ? 'Uploading...' : 'Submit Organic Post'}
          </button>
        </div>
      )}
    </div>
  );
}