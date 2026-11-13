import { matchesOrganicCampaign, type OrganicCampaignIdentity } from "../organicCampaignIdentity";
import { resolveOfferCurrency } from "../currency/proposalCurrency";
import { buildTrackingUrl, displayTrackingUrl } from "../tracking/buildTrackingUrl";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubmissionKind } from "./portalData";
const PAID="id,offer_id,status,created_at,business_viewed_at,file_url,thumbnail_url,media_type,headline,caption,call_to_action,cta,display_link,tracking_link,currency,budget_amount,budget_type,daily_budget,start_time,end_time,location,age_range,gender,interests,advantage_audience,placements_type,manual_placements";
const ORGANIC="id,offer_id,status,created_at,business_viewed_at,caption,platform,image_url,video_url,tracking_url,tracking_link,campaign_id,business_email,affiliate_email";
export type ProposalDetails = {
 id:string;kind:SubmissionKind;offerTitle:string;status:string;submittedAt:string|null;viewedAt:string|null;mediaUrl:string|null;thumbnailUrl:string|null;mediaType:string|null;
 headline:string|null;caption:string|null;cta:string|null;destinationUrl:string|null;trackingUrl:string|null;budget:number|null;budgetType:string|null;offerCurrency?:string|null;currencyBlock?:string|null;startAt:string|null;endAt:string|null;platform:string|null;
 targeting:{countries:string|null;ages:string[];gender:string|null;interests:string|null;advantageAudience:boolean|null};placements:string[];placementsType:string|null;
};
const text=(value:unknown)=>value==null || value===""?null:String(value);
const list=(value:unknown)=>Array.isArray(value)?value.map(String):value?[String(value)]:[];
export async function loadProposalDetails(client:SupabaseClient,email:string,kind:SubmissionKind,id:string):Promise<ProposalDetails|null> {
 // Explicit ownership applies even with the server service-role client.
 const {data,error}=await client.from(kind==="paid"?"ad_ideas":"organic_posts").select(kind==="paid"?PAID:ORGANIC).eq("id",id).eq("affiliate_email",email).maybeSingle();
 if(error) throw error;
 if(!data) return null;
 const row=data as unknown as Record<string,unknown>;
 const offer=await client.from("offers").select("title,currency").eq("id",row.offer_id).maybeSingle();
 if(offer.error) throw offer.error;
 let organicTrackingUrl: string | null = null;
 if (kind === "organic" && row.status === "approved") {
   const runtime = await client.from("live_campaigns").select("id,type,offer_id,business_email,affiliate_email")
     .in("id", [...new Set([String(row.id), text(row.campaign_id)].filter((id): id is string => !!id))]);
   if (runtime.error) throw runtime.error;
   const campaign = (runtime.data || []).find((candidate: OrganicCampaignIdentity) => matchesOrganicCampaign({
     id: String(row.id), status: String(row.status), offer_id: String(row.offer_id),
     business_email: String(row.business_email), affiliate_email: email,
   }, candidate));
   if (campaign) organicTrackingUrl = buildTrackingUrl({ campaignId: campaign.id, affiliateId: email });
 }
 const minor=Number(row.budget_amount || 0),legacy=Number(row.daily_budget || 0);
 return {
  id:String(row.id),kind,currencyBlock:kind === "paid" ? resolveOfferCurrency(row.currency, offer.data?.currency).message : null,offerCurrency:resolveOfferCurrency(row.currency, offer.data?.currency).campaignCurrency || null,offerTitle:String(offer.data?.title || "Offer"),status:String(row.status || "pending"),
  submittedAt:text(row.created_at),viewedAt:text(row.business_viewed_at),mediaUrl:text(row.file_url || row.video_url || row.image_url),thumbnailUrl:text(row.thumbnail_url),
  mediaType:text(row.media_type || (row.video_url?"video":row.image_url?"image":null)),headline:text(row.headline),caption:text(row.caption),cta:text(row.call_to_action || row.cta),
  destinationUrl:text(row.display_link),trackingUrl: kind === "organic" ? organicTrackingUrl : text(displayTrackingUrl(text(row.tracking_link || row.tracking_url), { runtimeId: String(row.id) })),
  budget:kind==="paid" && (minor>0 || legacy>0)?minor>0?minor/100:legacy:null,budgetType:text(row.budget_type),startAt:text(row.start_time),endAt:text(row.end_time),platform:text(row.platform),
  targeting:{countries:text(row.location),ages:list(row.age_range),gender:text(row.gender),interests:Array.isArray(row.interests)?row.interests.map(String).join(", "):text(row.interests),advantageAudience:typeof row.advantage_audience==="boolean"?row.advantage_audience:null},
  placements:list(row.manual_placements),placementsType:text(row.placements_type)
 };
}
