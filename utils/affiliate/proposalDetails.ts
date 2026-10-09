import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubmissionKind } from "./portalData";
const PAID="id,offer_id,status,created_at,business_viewed_at,file_url,thumbnail_url,media_type,headline,caption,call_to_action,cta,display_link,tracking_link,budget_amount,budget_type,daily_budget,start_time,end_time,location,age_range,gender,interests,advantage_audience,placements_type,manual_placements";
const ORGANIC="id,offer_id,status,created_at,business_viewed_at,caption,platform,image_url,video_url,tracking_url,tracking_link";
export type ProposalDetails = {
 id:string;kind:SubmissionKind;offerTitle:string;status:string;submittedAt:string|null;viewedAt:string|null;mediaUrl:string|null;thumbnailUrl:string|null;mediaType:string|null;
 headline:string|null;caption:string|null;cta:string|null;destinationUrl:string|null;trackingUrl:string|null;budget:number|null;budgetType:string|null;startAt:string|null;endAt:string|null;platform:string|null;
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
 const offer=await client.from("offers").select("title").eq("id",row.offer_id).maybeSingle();
 if(offer.error) throw offer.error;
 const minor=Number(row.budget_amount || 0),legacy=Number(row.daily_budget || 0);
 return {
  id:String(row.id),kind,offerTitle:String(offer.data?.title || "Offer"),status:String(row.status || "pending"),
  submittedAt:text(row.created_at),viewedAt:text(row.business_viewed_at),mediaUrl:text(row.file_url || row.video_url || row.image_url),thumbnailUrl:text(row.thumbnail_url),
  mediaType:text(row.media_type || (row.video_url?"video":row.image_url?"image":null)),headline:text(row.headline),caption:text(row.caption),cta:text(row.call_to_action || row.cta),
  destinationUrl:text(row.display_link),trackingUrl:text(row.tracking_link || row.tracking_url),
  budget:kind==="paid" && (minor>0 || legacy>0)?minor>0?minor/100:legacy:null,budgetType:text(row.budget_type),startAt:text(row.start_time),endAt:text(row.end_time),platform:text(row.platform),
  targeting:{countries:text(row.location),ages:list(row.age_range),gender:text(row.gender),interests:Array.isArray(row.interests)?row.interests.map(String).join(", "):text(row.interests),advantageAudience:typeof row.advantage_audience==="boolean"?row.advantage_audience:null},
  placements:list(row.manual_placements),placementsType:text(row.placements_type)
 };
}
