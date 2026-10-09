import type { SupabaseClient } from "@supabase/supabase-js";
export type SubmissionKind = "paid" | "organic";
export type AffiliateSubmission = { id:string; kind:SubmissionKind; offerId:string; offerTitle:string; status:string; createdAt:string|null; businessViewedAt:string|null; title:string; previewUrl:string|null; platform?:string|null };
export const cleanSubmissionStatus = (value:unknown) => String(value || "pending").trim().toLowerCase();
export const isAwaitingProposalReview = (value:unknown) => ["pending","submitted","viewed","in_review","under_review"].includes(cleanSubmissionStatus(value));
export const isArchivedCampaignStatus = (value?:string|null) => ["paused","archived","stopped","completed","ended","deleted"].includes(String(value || "unknown").trim().toLowerCase());
async function ownRows(client:SupabaseClient,table:string,columns:string,email:string) {
 const rows: Record<string,unknown>[] = [];
 for(let offset=0;;offset+=500) {
  const {data,error}=await client.from(table).select(columns).eq("affiliate_email",email).order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+499);
  if(error) throw error;
  const page=(data || []) as unknown as Record<string,unknown>[];
  rows.push(...page);
  if(page.length<500) return rows;
 }
}
export async function loadApprovedOfferIds(client:SupabaseClient,email:string) {
 const {data,error}=await client.from("affiliate_requests").select("offer_id").eq("affiliate_email",email).in("status",["approved","active","accepted"]);
 if(error) throw error;
 const ids=[...new Set((data || []).map(row=>String(row.offer_id || "")).filter(Boolean))];
 if(!ids.length) return [];
 const available=await client.from("offers").select("id").in("id",ids);
 if(available.error) throw available.error;
 return (available.data || []).map(row=>String(row.id));
}
export async function loadAffiliatePaidCampaigns(client:SupabaseClient,email:string) {
 return ownRows(client,"live_ads","id,offer_id,status,billing_state,meta_ad_id,meta_campaign_id,spend,spend_transferred,created_at",email);
}
export async function loadAffiliateSubmissions(client:SupabaseClient,email:string):Promise<AffiliateSubmission[]> {
 const [ads,organic]=await Promise.all([
  ownRows(client,"ad_ideas","id,offer_id,status,created_at,business_viewed_at,headline,caption,file_url",email),
  ownRows(client,"organic_posts","id,offer_id,status,created_at,business_viewed_at,caption,platform,image_url,video_url",email)
 ]);
 const ids=[...new Set([...ads,...organic].map(row=>String(row.offer_id || "")).filter(Boolean))];
 const titles=new Map<string,string>();
 if(ids.length) {
  const {data,error}=await client.from("offers").select("id,title").in("id",ids);
  if(error) throw error;
  for(const row of data || []) titles.set(String(row.id),String(row.title || "Offer"));
 }
 const convert=(row:Record<string,unknown>,kind:SubmissionKind):AffiliateSubmission=>({
  id:String(row.id),kind,offerId:String(row.offer_id || ""),offerTitle:titles.get(String(row.offer_id || "")) || "Offer",
  status:cleanSubmissionStatus(row.status),createdAt:row.created_at?String(row.created_at):null,businessViewedAt:row.business_viewed_at?String(row.business_viewed_at):null,
  title:String(row.headline || row.caption || (kind==="paid"?"Paid ad submission":"Organic promotion submission")),
  previewUrl:row.file_url || row.image_url || row.video_url?String(row.file_url || row.image_url || row.video_url):null,platform:row.platform?String(row.platform):null
 });
 return [...ads.map(row=>convert(row,"paid")),...organic.map(row=>convert(row,"organic"))].sort((a,b)=>(Date.parse(b.createdAt || "") || 0)-(Date.parse(a.createdAt || "") || 0));
}
