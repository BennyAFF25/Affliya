// eslint-disable-next-line
'use client';

import { useState, useEffect } from 'react';
import { fetchReachEstimate } from '@/../utils/meta/fetchReachEstimate';
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

  // --- Tracking Link for Affiliate ---
  const trackingLink = `https://affliya.vercel.app/go/${offerId}___${userEmail}`;

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

  // Reach estimate state
  const [reachEstimate, setReachEstimate] = useState<number | null>(null);

  // --- Estimated Reach Metrics (Potential Reach, Conversion Rate, Estimated Spend) ---
  // Dynamic state for conversion rate and estimated reach
  const [conversionRate, setConversionRate] = useState(3.2);
  const [estimatedReach, setEstimatedReach] = useState({ min: 12000, max: 25000 });
  // Use budget from formData or default to 50 if not set
  const budget = Number(formData.budget_amount) || 50;

  useEffect(() => {
    if (budget < 25) {
      setEstimatedReach({ min: 3000, max: 7000 });
      setConversionRate(1.4);
    } else if (budget < 50) {
      setEstimatedReach({ min: 8000, max: 16000 });
      setConversionRate(2.3);
    } else {
      setEstimatedReach({ min: 12000, max: 25000 });
      setConversionRate(3.2);
    }
  }, [budget]);

  // Estimated Spend: based on budget and ad type
  let minSpend = 18, maxSpend = 64;
  if (formData.budget_amount) {
    const base = Number(formData.budget_amount) || 18;
    minSpend = Math.round(base * 0.8);
    maxSpend = Math.round(base * 2.4);
  }

  // --- Targeting selection state for reach estimate ---
  // For demonstration, derive targeting selections from formData and state
  // Extract and parse targeting selections for the reach estimate
  // For a real app, these would be more structured and validated.
  // Countries: from location string (comma separated to array)
  const selectedCountries = formData.location
    ? formData.location.split(',').map((c) => c.trim()).filter(Boolean)
    : [];
  // Age min/max: from age_range string "18-65"
  const [selectedAgeMin, selectedAgeMax] = (() => {
    const [min, max] = (formData.age_range || '').split('-').map(Number);
    return [
      isNaN(min) ? 18 : min,
      isNaN(max) ? 65 : max
    ];
  })();
  // Gender: from formData.gender, convert to array of ints per Meta API
  // Meta: 1 = male, 2 = female
  const selectedGenders =
    formData.gender === 'Male'
      ? [1]
      : formData.gender === 'Female'
      ? [2]
      : formData.gender === 'All' || !formData.gender
      ? []
      : [];
  // Interests: from formData.interests (comma separated to array)
  const selectedInterests = formData.interests
    ? formData.interests.split(',').map((i) => i.trim()).filter(Boolean)
    : [];
  // Convert interests to objects with id and name
  const interestObjects = selectedInterests.map((interest) => ({
    id: interest,
    name: interest,
  }));

  // Business info: get from offer (simulate, as not available in current state)
  // In a real app, this would come from context or a fetch. Here, we'll simulate.
  const [business, setBusiness] = useState<{access_token: string; ad_account_id: string} | null>(null);

  // Fetch business info from offer on mount (simulate)
  useEffect(() => {
    // Only fetch once
    if (business) return;
    // Fetch offer info to get business access_token and ad_account_id
    const fetchBusiness = async () => {
      const { data, error } = await supabase
        .from('offers')
        .select('business_access_token, business_ad_account_id')
        .eq('id', offerId)
        .single();
      if (data && data.business_access_token && data.business_ad_account_id) {
        setBusiness({
          access_token: data.business_access_token,
          ad_account_id: data.business_ad_account_id
        });
      }
    };
    fetchBusiness();
    // eslint-disable-next-line
  }, [offerId]);

  // Fetch reach estimate when targeting selections change
  useEffect(() => {
    if (!business?.access_token || !business?.ad_account_id) return;

    const fetchEstimate = async () => {
      const estimate = await fetchReachEstimate({
        access_token: business.access_token,
        ad_account_id: business.ad_account_id,
        countries: selectedCountries,
        age_min: selectedAgeMin,
        age_max: selectedAgeMax,
        genders: selectedGenders,
        interests: interestObjects,
        optimization_goal: 'REACH',
        currency: 'AUD'
      });

      if (estimate?.users) {
        setReachEstimate(estimate.users);
      } else {
        setReachEstimate(null);
      }
    };

    fetchEstimate();
    // eslint-disable-next-line
  }, [business, selectedCountries, selectedAgeMin, selectedAgeMax, selectedGenders, selectedInterests]);

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

      // --- Insert tracking link in caption if not already present ---
      const trackingLink = `https://affliya.vercel.app/go/${offerId}___${userEmail}`;
      const finalCaption = formData.caption.includes('affliya.com/go') ? formData.caption : `${formData.caption}\n\n${trackingLink}`;

      const { data: offerData, error: offerError } = await supabase
        .from('offers')
        .select('business_email')
        .eq('id', offerId)
        .single();

      if (offerError || !offerData) throw new Error('Failed to fetch offer');

      const isVideo = organicFile.type.startsWith('video');
      const insertPayload = {
        platform: formData.platform,
        caption: finalCaption,
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
    <div className="min-h-screen py-12 px-6 bg-[#0e0e0e]">
      {/* Centered tab buttons */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setActiveTab('ad')}
          className={`px-5 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'ad'
              ? 'bg-[#00C2CB] text-white shadow'
              : 'bg-[#181818] text-[#00C2CB] border border-[#00C2CB] hover:bg-[#232323]'
          }`}
        >
          Submit Ad Idea
        </button>
        <button
          onClick={() => setActiveTab('organic')}
          className={`px-5 py-2 rounded-lg font-semibold transition-colors ${
            activeTab === 'organic'
              ? 'bg-[#00C2CB] text-white shadow'
              : 'bg-[#181818] text-[#00C2CB] border border-[#00C2CB] hover:bg-[#232323]'
          }`}
        >
          Submit Organic Post
        </button>
      </div>

      {activeTab === 'ad' && (
        <div className="flex flex-col lg:flex-row gap-10 justify-center items-start max-w-[1400px] mx-auto">
          {/* Left: form */}
          <div className="flex-1 max-w-2xl w-full bg-[#1a1a1a] rounded-2xl px-10 py-10 shadow-xl border border-[#232323]">
            {/* Stepper with labels below circles */}
            <div className="flex justify-between w-full max-w-lg mx-auto mb-8">
              {[
                { label: 'Basic Info' },
                { label: 'Objective' },
                { label: 'Targeting' },
                { label: 'Media' },
                { label: 'Details' },
              ].map((stepObj, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1">
                  <div
                    className={`rounded-full w-8 h-8 flex items-center justify-center font-bold text-base border-2 transition-colors ${
                      step === idx + 1
                        ? 'bg-[#00C2CB] text-white border-[#00C2CB]'
                        : 'bg-[#232323] text-gray-400 border-[#232323]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span className="text-xs text-gray-400 font-medium mt-2 text-center">
                    {stepObj.label}
                  </span>
                  {idx < 4 && (
                    <div className="absolute top-4 right-0 left-full flex-1 h-1 mx-1 bg-[#232323] rounded hidden" />
                  )}
                </div>
              ))}
            </div>
            {/* Form Step Content */}
            <div className="mb-8">
              {step === 1 && (
                <div className="space-y-6">
                  <input
                    name="headline"
                    onChange={handleInput}
                    value={formData.headline}
                    placeholder="Headline"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <textarea
                    name="caption"
                    onChange={handleInput}
                    value={formData.caption}
                    placeholder="Caption"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  {/* Tracking Link and Copy Button */}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={trackingLink}
                      readOnly
                      className="bg-[#101010] border border-[#232323] text-white rounded-lg px-4 py-2 w-full text-sm opacity-80"
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(trackingLink);
                        alert('Tracking link copied!');
                      }}
                      className="px-4 py-2 rounded-lg bg-[#00C2CB] text-white text-sm font-semibold hover:bg-[#00b0b8] transition"
                    >
                      Copy
                    </button>
                  </div>
                  <textarea
                    name="description"
                    onChange={handleInput}
                    value={formData.description}
                    placeholder="Description"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <input
                    name="display_link"
                    onChange={handleInput}
                    value={formData.display_link}
                    placeholder="Destination Link"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                </div>
              )}
              {step === 2 && (
                <div className="space-y-6">
                  <select
                    name="objective"
                    onChange={handleInput}
                    value={formData.objective}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
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
                  <select
                    name="call_to_action"
                    onChange={handleInput}
                    value={formData.call_to_action}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="LEARN_MORE">Learn More</option>
                    <option value="SHOP_NOW">Shop Now</option>
                    <option value="SIGN_UP">Sign Up</option>
                  </select>
                  <input
                    name="budget_amount"
                    onChange={handleInput}
                    value={formData.budget_amount}
                    placeholder="Budget Amount"
                    type="number"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <select
                    name="budget_type"
                    onChange={handleInput}
                    value={formData.budget_type}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="LIFETIME">Lifetime</option>
                  </select>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-6">
                  <input
                    name="start_time"
                    onChange={handleInput}
                    value={formData.start_time}
                    placeholder="Start DateTime"
                    type="datetime-local"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <input
                    name="end_time"
                    onChange={handleInput}
                    value={formData.end_time}
                    placeholder="End DateTime"
                    type="datetime-local"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <select
                    name="audience"
                    onChange={handleInput}
                    value={formData.audience}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="">Select Audience</option>
                    <option value="Core">Core (Demographic/Interest/Behavior)</option>
                    <option value="Custom">Custom Audience</option>
                    <option value="Lookalike">Lookalike Audience</option>
                  </select>
                  <input
                    name="location"
                    onChange={handleInput}
                    value={formData.location}
                    placeholder="Location"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  {/* Age Range */}
                  <div>
                    <label className="block text-xs font-semibold mb-2 text-[#00C2CB]">
                      Age Range: {formData.age_range || '18-65'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="range"
                        min="18"
                        max="65"
                        step="1"
                        value={formData.age_range.split('-')[0] || 18}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            age_range: `${e.target.value}-${prev.age_range.split('-')[1] || 65}`,
                          }))
                        }
                        className="w-full accent-[#00C2CB]"
                      />
                      <input
                        type="range"
                        min="18"
                        max="65"
                        step="1"
                        value={formData.age_range.split('-')[1] || 65}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            age_range: `${prev.age_range.split('-')[0] || 18}-${e.target.value}`,
                          }))
                        }
                        className="w-full accent-[#00C2CB]"
                      />
                    </div>
                  </div>
                  <select
                    name="gender"
                    onChange={handleInput}
                    value={formData.gender}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="">Select Gender</option>
                    <option value="All">All</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <input
                    name="interests"
                    onChange={handleInput}
                    value={formData.interests}
                    placeholder="Interests (e.g., Fitness, Tech, Travel)"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                </div>
              )}
              {step === 4 && (
                <div>
                  {/* Drag and drop upload box */}
                  <div className="mb-8">
                    <div className="bg-[#232323] border-2 border-dashed border-[#00C2CB] rounded-xl flex flex-col items-center justify-center py-10 px-4">
                      <span className="text-[#00C2CB] font-semibold text-lg mb-2">
                        Drag and drop your image or video
                      </span>
                      <span className="text-gray-400 mb-4 text-xs">
                        or click below to upload
                      </span>
                      <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
                        <label className="block text-xs text-gray-400 mb-1">Ad Media Type</label>
                        <select
                          className="bg-[#181818] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-2 w-full mb-2"
                          value={mediaType}
                          onChange={(e) => setMediaType(e.target.value as 'VIDEO' | 'IMAGE')}
                        >
                          <option value="VIDEO">Video</option>
                          <option value="IMAGE">Image</option>
                        </select>
                        <label className="block text-xs text-gray-400 mb-1">
                          {mediaType === 'VIDEO'
                            ? 'Upload Video'
                            : 'Upload Image'}
                        </label>
                        <input
                          type="file"
                          accept={mediaType === 'VIDEO' ? 'video/*' : 'image/*'}
                          onChange={(e) => handleFileChange(e, 'video')}
                          className="bg-[#181818] border border-[#232323] text-white rounded-lg px-4 py-2 w-full mb-2"
                        />
                        <label className="block text-xs text-gray-400 mb-1">Upload Thumbnail</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'thumbnail')}
                          className="bg-[#181818] border border-[#232323] text-white rounded-lg px-4 py-2 w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {step === 5 && (
                <div className="space-y-6">
                  <input
                    name="campaign_name"
                    onChange={handleInput}
                    value={formData.campaign_name}
                    placeholder="Campaign Name"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <select
                    name="special_ad_category"
                    onChange={handleInput}
                    value={formData.special_ad_category}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="">Select Special Ad Category</option>
                    <option value="NONE">NONE</option>
                    <option value="EMPLOYMENT">EMPLOYMENT</option>
                    <option value="HOUSING">HOUSING</option>
                    <option value="CREDIT">CREDIT</option>
                    <option value="POLITICAL">POLITICAL</option>
                  </select>
                  <input
                    name="ad_set_name"
                    onChange={handleInput}
                    value={formData.ad_set_name}
                    placeholder="Ad Set Name"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <select
                    name="conversion_location"
                    onChange={handleInput}
                    value={formData.conversion_location}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="">Select Conversion Location</option>
                    <option value="WEBSITE">Website</option>
                    <option value="APP">App</option>
                    <option value="MESSENGER">Messenger</option>
                  </select>
                  <select
                    name="dataset_id"
                    onChange={handleInput}
                    value={formData.dataset_id}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="">Select Pixel/Dataset</option>
                    <option value="pixel_001">Pixel #001</option>
                    <option value="pixel_002">Pixel #002</option>
                    <option value="pixel_custom">My Custom Pixel</option>
                  </select>
                  <select
                    name="conversion_event"
                    onChange={handleInput}
                    value={formData.conversion_event}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="">Select Conversion Event</option>
                    <option value="PURCHASE">Purchase</option>
                    <option value="LEAD">Lead</option>
                    <option value="ADD_TO_CART">Add to Cart</option>
                    <option value="COMPLETE_REGISTRATION">Complete Registration</option>
                    <option value="SUBSCRIBE">Subscribe</option>
                    <option value="INITIATE_CHECKOUT">Initiate Checkout</option>
                    <option value="VIEW_CONTENT">View Content</option>
                  </select>
                  <select
                    name="performance_goal"
                    onChange={handleInput}
                    value={formData.performance_goal}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="">Select Performance Goal</option>
                    <option value="REACH">Reach</option>
                    <option value="LINK_CLICKS">Link Clicks</option>
                    <option value="CONVERSIONS">Conversions</option>
                    <option value="LEAD_GENERATION">Lead Generation</option>
                  </select>
                  <select
                    name="placements_type"
                    onChange={handleInput}
                    value={formData.placements_type}
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
                  >
                    <option value="">Select Placements Type</option>
                    <option value="AUTO">Automatic</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                  <input
                    name="ad_name"
                    onChange={handleInput}
                    value={formData.ad_name}
                    placeholder="Ad Name"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <input
                    name="page_id"
                    onChange={handleInput}
                    value={formData.page_id}
                    placeholder="Facebook Page ID"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                  <input
                    name="instagram_id"
                    onChange={handleInput}
                    value={formData.instagram_id}
                    placeholder="Instagram Account ID"
                    className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
                  />
                </div>
              )}
            </div>
            {/* Reach Estimate */}
            {reachEstimate !== null && (
              <div className="mb-8 p-4 rounded-xl bg-[#232323] border border-[#232323] text-white shadow-sm flex flex-col gap-1">
                <span className="text-xs text-gray-400">Estimated Audience Reach</span>
                <span className="text-2xl font-bold text-[#00C2CB]">
                  {reachEstimate.toLocaleString()} people
                </span>
              </div>
            )}
            {/* Navigation Buttons */}
            <div className="flex justify-between mt-10 gap-4">
              <button
                className="px-8 py-2 rounded-lg border border-[#00C2CB] text-[#00C2CB] font-semibold bg-[#181818] hover:bg-[#232323] transition disabled:opacity-40"
                disabled={step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                Back
              </button>
              {step < 5 ? (
                <button
                  className="px-8 py-2 rounded-lg bg-[#00C2CB] text-white font-semibold hover:bg-[#00b0b8] transition"
                  onClick={() => setStep((s) => Math.min(5, s + 1))}
                >
                  Next
                </button>
              ) : (
                <button
                  disabled={loading}
                  onClick={handleSubmit}
                  className="px-8 py-2 rounded-lg bg-[#00C2CB] text-white font-semibold hover:bg-[#00b0b8] transition disabled:opacity-40"
                >
                  {loading ? 'Submitting...' : 'Submit Ad Idea'}
                </button>
              )}
            </div>
          </div>
          {/* Right: Estimated Reach Box */}
          <div className="w-full max-w-sm lg:ml-8 mt-10 lg:mt-0">
            <div className="bg-[#1a1a1a] rounded-2xl border border-[#232323] shadow-xl p-8 flex flex-col gap-6">
              {/* Metrics */}
              <div>
                <h2 className="text-xl font-bold text-[#00C2CB] mb-6">Estimated Reach</h2>
                {/* 
                  --- Reach Metrics ---
                  Now using dynamic state for reach and conversion rate.
                */}
                <div className="mb-5">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">Potential Reach</span>
                    <p className="text-white text-sm">
                      {estimatedReach.min.toLocaleString()}–{estimatedReach.max.toLocaleString()}
                    </p>
                  </div>
                  <div className="w-full h-2 rounded bg-[#232323]">
                    <div className="h-2 rounded bg-[#00C2CB]" style={{ width: '72%' }} />
                  </div>
                </div>
                <div className="mb-5">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">Conversion Rate</span>
                    <p className="text-white text-sm">{conversionRate}%</p>
                  </div>
                  <div className="w-full h-2 rounded bg-[#232323]">
                    <div className="h-2 rounded bg-[#00C2CB]" style={{ width: '32%' }} />
                  </div>
                </div>
                <div className="mb-7">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">Estimated Spend</span>
                    <p className="text-white text-sm">${minSpend}—${maxSpend}</p>
                  </div>
                  <div className="w-full h-2 rounded bg-[#232323]">
                    <div className="h-2 rounded bg-[#00C2CB]" style={{ width: '44%' }} />
                  </div>
                </div>
              </div>
              {/* Preview Card */}
              <div className="rounded-xl bg-[#232323] p-6 shadow flex flex-col items-center mt-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#00C2CB] flex items-center justify-center text-white font-bold text-lg">
                    {/* Profile Initials Placeholder */}
                    P
                  </div>
                  <div>
                    <div className="text-sm text-white font-semibold">Profile Name</div>
                    <div className="text-xs text-gray-400">Sponsored</div>
                  </div>
                </div>
                <div className="w-full h-44 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center mb-4 overflow-hidden">
                  {/* Ad Image/Video Placeholder */}
                  {mediaType === 'VIDEO' && videoFile ? (
                    <video controls className="w-full h-full object-cover rounded-lg">
                      <source src={URL.createObjectURL(videoFile)} type={videoFile.type} />
                      Your browser does not support the video tag.
                    </video>
                  ) : mediaType === 'IMAGE' && videoFile ? (
                    <img src={URL.createObjectURL(videoFile)} alt="Ad Preview" className="w-full h-full object-cover rounded-lg" />
                  ) : thumbnailFile ? (
                    <img src={URL.createObjectURL(thumbnailFile)} alt="Thumbnail" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <span className="text-gray-500">Ad Image/Video</span>
                  )}
                </div>
                <div className="w-full">
                  <div className="text-base font-semibold text-white truncate">
                    {formData.headline || 'Ad Headline Preview'}
                  </div>
                  <div className="text-sm text-gray-400 truncate mb-2">
                    {formData.caption || 'Ad caption preview…'}
                  </div>
                  <button className="w-full mt-2 py-2 rounded-lg bg-[#00C2CB] text-white font-bold text-sm hover:bg-[#00b0b8] transition">
                    {formData.call_to_action.replace('_', ' ').toUpperCase() || 'LEARN MORE'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'organic' && (
        <div className="flex flex-col lg:flex-row gap-10 justify-center items-start max-w-[1400px] mx-auto mt-12">
          {/* Left: Organic Form */}
          <div className="max-w-lg w-full bg-[#1a1a1a] rounded-2xl shadow-xl border border-[#232323] p-10">
            <h2 className="text-2xl font-bold text-[#00C2CB] mb-6">Submit Organic Post</h2>
            <div className="space-y-6">
              <select
                name="platform"
                onChange={handleInput}
                value={formData.platform || ''}
                className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full"
              >
                <option value="">Select Platform</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
              <input
                name="caption"
                onChange={handleInput}
                value={formData.caption}
                placeholder="Caption"
                className="bg-[#101010] border border-[#232323] focus:border-[#00C2CB] text-white rounded-lg px-4 py-3 w-full placeholder-gray-400"
              />
              {/* Tracking Link and Copy Button for Organic */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={trackingLink}
                  readOnly
                  className="bg-[#101010] border border-[#232323] text-white rounded-lg px-4 py-2 w-full text-sm opacity-80"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(trackingLink);
                    alert('Tracking link copied!');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#00C2CB] text-white text-sm font-semibold hover:bg-[#00b0b8] transition"
                >
                  Copy
                </button>
              </div>
              <div className="bg-[#232323] border-2 border-dashed border-[#00C2CB] rounded-xl flex flex-col items-center justify-center py-8 px-4">
                <span className="text-[#00C2CB] font-semibold text-base mb-2">
                  Drag and drop your image or video
                </span>
                <span className="text-gray-400 mb-3 text-xs">
                  or click below to upload
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => handleFileChange(e, 'organic')}
                  className="bg-[#181818] border border-[#232323] text-white rounded-lg px-4 py-2 w-full"
                />
                {organicFile && (
                  <div className="mt-4 w-full rounded-lg overflow-hidden">
                    {organicFile.type.includes('video') ? (
                      <video
                        src={URL.createObjectURL(organicFile)}
                        controls
                        className="w-full h-auto rounded-lg"
                      />
                    ) : (
                      <img
                        src={URL.createObjectURL(organicFile)}
                        alt="Organic preview"
                        className="w-full h-auto rounded-lg"
                      />
                    )}
                  </div>
                )}
              </div>
              <button
                disabled={loading}
                onClick={handleUpload}
                className="w-full py-3 rounded-lg bg-[#00C2CB] text-white font-semibold text-base hover:bg-[#00b0b8] transition disabled:opacity-50"
              >
                {loading ? 'Uploading...' : 'Submit Organic Post'}
              </button>
            </div>
          </div>

          {/* Right: Preview Card */}
          <div className="w-full max-w-sm lg:ml-2 mt-10 lg:mt-0">
            <div className="bg-[#1a1a1a] rounded-2xl border border-[#232323] shadow-xl p-6 flex flex-col items-center">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#00C2CB] flex items-center justify-center text-white font-bold text-lg">
                  P
                </div>
                <div>
                  <div className="text-sm text-white font-semibold">Profile Name</div>
                  <div className="text-xs text-gray-400">Sponsored</div>
                </div>
              </div>
              <div className="w-full h-44 rounded-lg bg-[#1a1a1a] border border-[#232323] flex items-center justify-center mb-4 overflow-hidden">
                {organicFile ? (
                  organicFile.type.includes('video') ? (
                    <video controls className="w-full h-full object-cover rounded-lg">
                      <source src={URL.createObjectURL(organicFile)} type={organicFile.type} />
                    </video>
                  ) : (
                    <img src={URL.createObjectURL(organicFile)} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                  )
                ) : (
                  <span className="text-gray-500">Ad Image/Video</span>
                )}
              </div>
              <div className="w-full">
                <div className="text-base font-semibold text-white truncate">
                  {formData.caption || 'Ad Headline Preview'}
                </div>
                <div className="text-sm text-gray-400 truncate mb-2">
                  Organic Post Preview
                </div>
                <button className="w-full mt-2 py-2 rounded-lg bg-[#00C2CB] text-white font-bold text-sm hover:bg-[#00b0b8] transition">
                  {formData.platform ? formData.platform.toUpperCase() : 'LEARN MORE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
