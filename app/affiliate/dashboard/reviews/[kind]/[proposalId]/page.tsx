"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect,useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { isRenderableAssetUrl } from "utils/contentLibrary";
import type { ProposalDetails } from "utils/affiliate/proposalDetails";
const date=(value:string|null)=>value && Number.isFinite(Date.parse(value))?new Date(value).toLocaleString():"Not saved";
const label=(value:string|null|undefined)=>value?.replace(/_/g," ") || "Not saved";
const safeLink=(value:string|null)=>{try{const parsed=new URL(value || "");return ["http:","https:"].includes(parsed.protocol)?parsed.href:null;}catch{return null;}};
export default function SubmittedProposalPage(){
 const params=useParams<{kind:string;proposalId:string}>();
 const {session,isLoading}=useSessionContext();
 const [proposal,setProposal]=useState<ProposalDetails|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null),[reload,setReload]=useState(0);
 useEffect(()=>{
  if(isLoading) return;
  if(!session){setLoading(false);return;}
  let cancelled=false;
  const controller=new AbortController(),timeout=window.setTimeout(()=>controller.abort(),10000);
  setLoading(true);setError(null);setProposal(null);
  fetch(`/api/affiliate/proposals/${params.kind}/${params.proposalId}`,{cache:"no-store",signal:controller.signal})
   .then(async res=>{const body=await res.json().catch(()=>null);if(!res.ok || !body?.ok) throw new Error(body?.error || "Could not load your proposal.");if(!cancelled)setProposal(body.proposal);})
   .catch(err=>{if(!cancelled)setError(controller.signal.aborted?"The request timed out. Please try again.":err.message);})
   .finally(()=>{window.clearTimeout(timeout);if(!cancelled)setLoading(false);});
  return ()=>{cancelled=true;window.clearTimeout(timeout);controller.abort();};
 },[params.kind,params.proposalId,session?.user?.id,isLoading,reload]);
 const field=(name:string,value:string|null|undefined)=><div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--secondary)] p-4"><dt className="text-xs text-[var(--muted-foreground)]">{name}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm">{value || "Not saved"}</dd></div>;
 const link=(name:string,value:string|null)=><div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--secondary)] p-4"><dt className="text-xs text-[var(--muted-foreground)]">{name}</dt><dd className="mt-2 break-all text-sm">{safeLink(value)?<a href={safeLink(value)!} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">{value}</a>:value || "Not saved"}</dd></div>;
 return <main className="min-h-screen bg-[var(--background)] px-4 py-6 text-[var(--foreground)] sm:px-6"><div className="mx-auto max-w-4xl space-y-5">
  <Link href="/affiliate/dashboard/reviews" className="text-sm text-[var(--muted-foreground)]">← Back to submitted reviews</Link>
  {loading || isLoading?<p>Loading submitted proposal…</p>:error?<div role="alert" className="rounded-2xl border border-amber-400/20 p-5"><p>{error}</p><button onClick={()=>setReload(value=>value+1)} className="mt-3 text-[var(--primary)]">Try again</button></div>:proposal?<>
   <header className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"><p className="text-xs uppercase tracking-wider text-[var(--primary)]">Submitted proposal · read only</p><h1 className="mt-2 text-2xl font-semibold">{proposal.offerTitle}</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">{proposal.kind==="paid"?"Paid campaign":"Organic promotion"} · {label(proposal.status)}</p></header>
   <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5"><h2 className="text-lg font-semibold">Submitted creative</h2>
    {isRenderableAssetUrl(proposal.mediaUrl)?String(proposal.mediaType).toLowerCase()==="video" || /\.(mp4|webm|mov)(\?|$)/i.test(proposal.mediaUrl || "")?<video controls playsInline src={proposal.mediaUrl!} poster={isRenderableAssetUrl(proposal.thumbnailUrl)?proposal.thumbnailUrl!:undefined} className="mt-4 max-h-[420px] w-full rounded-2xl bg-black object-contain"/>:<img src={proposal.mediaUrl!} alt="Submitted creative" className="mt-4 max-h-[420px] w-full rounded-2xl object-contain"/>:<p className="mt-3 text-sm text-[var(--muted-foreground)]">No media was saved with this proposal.</p>}
   </section>
   <dl className="grid gap-3 sm:grid-cols-2">
    {field("Headline",proposal.headline)}{field("Caption",proposal.caption)}{field("CTA",label(proposal.cta))}{link("Destination URL",proposal.destinationUrl)}{link("Tracking URL",proposal.trackingUrl)}
    {field("Budget",proposal.budget==null?proposal.kind==="organic"?"Not applicable to organic promotion":"Not saved":`${proposal.budget.toFixed(2)} · ${label(proposal.budgetType)} (currency not saved)`)}
    {field("Schedule",proposal.kind==="organic"?"Not scheduled through Nettmark":`Start: ${date(proposal.startAt)}\nEnd: ${date(proposal.endAt)}`)}
    {field("Targeting",proposal.kind==="organic"?"Not applicable to organic promotion":`Countries: ${proposal.targeting.countries || "Not saved"}\nAges: ${proposal.targeting.ages.join("–") || "Not saved"}\nGender: ${proposal.targeting.gender || "Not saved"}\nInterests: ${proposal.targeting.interests || "Not saved"}\nAdvantage audience: ${proposal.targeting.advantageAudience==null?"Not saved":proposal.targeting.advantageAudience?"On":"Off"}`)}
    {field("Placements",proposal.kind==="organic"?proposal.platform:`${label(proposal.placementsType)}\n${proposal.placements.join(", ") || "Not saved"}`)}
    {field("Status",label(proposal.status))}{field("Submitted",date(proposal.submittedAt))}{field("Viewed by business",proposal.viewedAt?date(proposal.viewedAt):"Not viewed yet")}
   </dl>
  </>:<p>Please sign in to view your proposal.</p>}
 </div></main>;
}
