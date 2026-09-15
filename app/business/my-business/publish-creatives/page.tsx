"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@supabase/auth-helpers-react";
import { supabase } from "@/../utils/supabase/pages-client";
import { FiArchive, FiEdit3, FiFilm, FiFolder, FiPlus, FiRefreshCw, FiTrash2, FiUpload, FiX } from "react-icons/fi";
import { nmToast } from "@/components/ui/toast";
import type { ContentLibraryAsset } from "@/../utils/contentLibrary";
import { CONTENT_LIBRARY_BUCKET, getApprovalLabel, getUsageScopeLabel, inferMediaType, slugifyFilenamePart, validateCreativeFile, validateThumbnailFile } from "@/../utils/contentLibrary";

type OfferOption = { id: string; title: string };
type FilterKey = "all" | "image" | "video" | "paid" | "organic" | "archived";
type FormState = {
  id: string | null; title: string; caption: string; offerId: string; usageScope: "all" | "offer";
  allowOrganic: boolean; allowPaid: boolean; organicPreapproved: boolean; paidPreapproved: boolean;
  isActive: boolean; file: File | null; thumbnail: File | null; clearThumbnail: boolean;
};
const EMPTY: FormState = { id:null,title:"",caption:"",offerId:"",usageScope:"all",allowOrganic:true,allowPaid:false,organicPreapproved:false,paidPreapproved:false,isActive:true,file:null,thumbnail:null,clearThumbnail:false };
const FILTERS: FilterKey[] = ["all","image","video","paid","organic","archived"];

function formData(form: FormState) {
  const fd = new FormData();
  fd.set("title", form.title); fd.set("caption", form.caption);
  fd.set("offer_id", form.usageScope === "offer" ? form.offerId : "");
  fd.set("allow_organic", String(form.allowOrganic)); fd.set("allow_paid", String(form.allowPaid));
  fd.set("organic_preapproved", String(form.organicPreapproved)); fd.set("paid_preapproved", String(form.paidPreapproved));
  fd.set("is_active", String(form.isActive)); fd.set("replace_thumbnail", String(form.clearThumbnail));
  return fd;
}

async function uploadFile(file: File, userId: string, kind: "asset" | "thumbnail") {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const base = slugifyFilenamePart(file.name.replace(/\.[^.]+$/, ""));
  const path = `${userId}/${kind === "thumbnail" ? "thumbnails" : "assets"}/${Date.now()}-${base}.${ext}`;
  const { error } = await supabase.storage.from(CONTENT_LIBRARY_BUCKET).upload(path, file, { upsert:false, contentType:file.type });
  if (error) throw new Error(`Creative ${kind} upload failed: ${error.message}`);
  const { data } = supabase.storage.from(CONTENT_LIBRARY_BUCKET).getPublicUrl(path);
  return { filePath:path, publicUrl:data.publicUrl };
}

async function readJson(res: Response) { const text = await res.text(); try { return text ? JSON.parse(text) : null; } catch { return null; } }

export default function BusinessCreativesPage() {
  const session = useSession(); const user = session?.user;
  const [assets,setAssets] = useState<ContentLibraryAsset[]>([]); const [offers,setOffers] = useState<OfferOption[]>([]);
  const [loading,setLoading] = useState(true); const [saving,setSaving] = useState(false); const [filter,setFilter] = useState<FilterKey>("all");
  const [open,setOpen] = useState(false); const [form,setForm] = useState<FormState>(EMPTY); const [resetKey,setResetKey] = useState(0);

  const load = async () => {
    if (!user?.email) { setLoading(false); return; }
    setLoading(true);
    try { const res=await fetch("/api/business/content-library",{cache:"no-store"}); const json=await readJson(res); if(!res.ok||!json?.ok) throw new Error(json?.error||"Failed to load content library"); setAssets(json.assets||[]); setOffers(json.offers||[]); }
    catch(e:any){ console.error("[content-library] load",e); nmToast.error(e?.message||"Failed to load content library"); }
    finally{setLoading(false);}
  };
  useEffect(()=>{ if(user?.email) void load(); },[user?.email]);
  useEffect(()=>{ if(typeof window==="undefined")return; const p=new URLSearchParams(window.location.search); if(p.get("open")!=="1")return; const scope=p.get("scope")==="offer"?"offer":"all"; setForm({...EMPTY,usageScope:scope,offerId:scope==="offer"?(p.get("offerId")||""):""}); setOpen(true); },[]);

  const visible=useMemo(()=>assets.filter(a=>filter==="all"?true:filter==="archived"?!a.is_active:filter==="image"?a.media_type==="image"&&a.is_active:filter==="video"?a.media_type==="video"&&a.is_active:filter==="paid"?!!a.allow_paid&&a.is_active:!!a.allow_organic&&a.is_active),[assets,filter]);
  const start=(scope:"all"|"offer"="all",offerId="")=>{setForm({...EMPTY,usageScope:scope,offerId});setResetKey(v=>v+1);setOpen(true);};
  const edit=(a:ContentLibraryAsset)=>{setForm({id:a.id,title:a.title||"",caption:a.caption||"",offerId:a.offer_id||"",usageScope:a.offer_id?"offer":"all",allowOrganic:!!a.allow_organic,allowPaid:!!a.allow_paid,organicPreapproved:!!a.organic_preapproved,paidPreapproved:!!a.paid_preapproved,isActive:!!a.is_active,file:null,thumbnail:null,clearThumbnail:false});setResetKey(v=>v+1);setOpen(true);};
  const close=()=>{setOpen(false);setForm(EMPTY);};

  const save=async()=>{
    if(!user?.id){nmToast.error("Your session is not ready. Refresh and try again.");return;}
    if(!form.title.trim()){nmToast.error("Add a title so affiliates can recognise this creative.");return;}
    if(!form.allowOrganic&&!form.allowPaid){nmToast.error("Choose at least one usage mode.");return;}
    if(form.usageScope==="offer"&&!form.offerId){nmToast.error("Choose an offer.");return;}
    if(!form.id&&!form.file){nmToast.error("Upload an image or video.");return;}
    setSaving(true);
    try{
      const fd=formData(form);
      if(form.file){const err=validateCreativeFile(form.file);if(err)throw new Error(err);const media=inferMediaType(form.file);if(!media)throw new Error("Unsupported media type.");const up=await uploadFile(form.file,user.id,"asset");fd.set("media_url",up.publicUrl);fd.set("file_path",up.filePath);fd.set("media_type",media);fd.set("source_filename",form.file.name);}
      if(form.thumbnail){const err=validateThumbnailFile(form.thumbnail);if(err)throw new Error(err);const up=await uploadFile(form.thumbnail,user.id,"thumbnail");fd.set("thumbnail_url",up.publicUrl);fd.set("thumbnail_path",up.filePath);}
      const res=await fetch(form.id?`/api/business/content-library/${form.id}`:"/api/business/content-library",{method:form.id?"PATCH":"POST",body:fd});const json=await readJson(res);if(!res.ok||!json?.ok)throw new Error(json?.error||"Failed to save asset");
      nmToast.success(form.id?"Asset updated":"Asset uploaded");close();await load();
    }catch(e:any){console.error("[content-library] save",e);nmToast.error(e?.message||"Failed to save asset");}finally{setSaving(false);}
  };

  const archive=async(a:ContentLibraryAsset)=>{const fd=new FormData();fd.set("title",a.title||"Untitled creative");fd.set("caption",a.caption||"");fd.set("offer_id",a.offer_id||"");fd.set("allow_organic",String(!!a.allow_organic));fd.set("allow_paid",String(!!a.allow_paid));fd.set("organic_preapproved",String(!!a.organic_preapproved));fd.set("paid_preapproved",String(!!a.paid_preapproved));fd.set("is_active",String(!a.is_active));const res=await fetch(`/api/business/content-library/${a.id}`,{method:"PATCH",body:fd});const json=await readJson(res);if(!res.ok||!json?.ok){nmToast.error(json?.error||"Failed to update asset");return;}await load();};
  const remove=async(a:ContentLibraryAsset)=>{if(!window.confirm(`Delete \"${a.title||"Untitled creative"}\"?`))return;const res=await fetch(`/api/business/content-library/${a.id}`,{method:"DELETE"});const json=await readJson(res);if(!res.ok||!json?.ok){nmToast.error(json?.error||"Failed to delete asset");return;}await load();};

  return <div className="publish-creatives-theme min-h-screen bg-[var(--background)] p-6 text-[var(--foreground)] sm:p-10"><div className="mx-auto max-w-7xl space-y-6">
    <header className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-[var(--primary)]"><FiFolder/> Content Library</div><h1 className="text-3xl font-bold">Content Library</h1><p className="mt-3 max-w-2xl text-sm text-[var(--muted-foreground)]">Upload approved images, videos and copy that affiliates can use across your offers.</p></div><div className="flex gap-3"><button onClick={()=>void load()} className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"><FiRefreshCw className="mr-2 inline"/>Refresh</button><button onClick={()=>start()} className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)]"><FiPlus className="mr-2 inline"/>Upload content</button></div></div></header>
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4"><div className="flex flex-wrap gap-2">{FILTERS.map(f=><button key={f} onClick={()=>setFilter(f)} className={`rounded-full border px-3 py-2 text-sm ${filter===f?"border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]":"border-[var(--border)]"}`}>{f[0].toUpperCase()+f.slice(1)}</button>)}</div></section>
    {loading?<div className="p-12 text-center text-[var(--muted-foreground)]">Loading content library…</div>:visible.length===0?<div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center"><FiUpload className="mx-auto mb-4 h-7 w-7"/><h2 className="text-xl font-semibold">Give affiliates something to start with.</h2><button onClick={()=>start()} className="mt-6 rounded-2xl bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)]">Upload your first creative</button></div>:<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{visible.map(a=><article key={a.id} className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)]"><div className="aspect-[4/3] bg-black/50">{a.media_type==="video"?<video controls className="h-full w-full object-cover" poster={a.thumbnail_url||undefined}><source src={a.media_url}/></video>:<img src={a.media_url} alt={a.title||"Creative"} className="h-full w-full object-cover"/>}</div><div className="space-y-3 p-5"><h3 className="text-lg font-semibold">{a.title||"Untitled creative"}</h3><p className="text-sm text-[var(--muted-foreground)]">{a.caption||"No suggested copy yet."}</p><div className="text-xs text-[var(--muted-foreground)]">{getUsageScopeLabel(a)} · {getApprovalLabel(a)}</div><div className="flex flex-wrap gap-2"><button onClick={()=>edit(a)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><FiEdit3 className="mr-2 inline"/>Edit</button><button onClick={()=>void archive(a)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><FiArchive className="mr-2 inline"/>{a.is_active?"Archive":"Restore"}</button><button onClick={()=>void remove(a)} className="rounded-xl border border-red-500/25 px-3 py-2 text-sm text-red-300"><FiTrash2 className="mr-2 inline"/>Delete</button></div></div></article>)}</div>}
  </div>
  {open&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6"><div className="flex justify-between"><div><h2 className="text-2xl font-semibold">{form.id?"Edit content asset":"Upload content"}</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Upload once, then let affiliates reuse it.</p></div><button onClick={close}><FiX/></button></div><div className="mt-6 grid gap-5 lg:grid-cols-2"><div className="space-y-4"><input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="Creative title" className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] px-4 py-3"/><textarea value={form.caption} onChange={e=>setForm(p=>({...p,caption:e.target.value}))} placeholder="Suggested caption / copy" className="min-h-32 w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] px-4 py-3"/><div className="flex gap-2"><button onClick={()=>setForm(p=>({...p,usageScope:"all",offerId:""}))} className="rounded-full border px-3 py-2 text-sm">All offers</button><button onClick={()=>setForm(p=>({...p,usageScope:"offer"}))} className="rounded-full border px-3 py-2 text-sm">One offer</button></div>{form.usageScope==="offer"&&<select value={form.offerId} onChange={e=>setForm(p=>({...p,offerId:e.target.value}))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--input-background)] px-4 py-3"><option value="">Select offer</option>{offers.map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select>}<label className="block"><input type="checkbox" checked={form.allowOrganic} onChange={e=>setForm(p=>({...p,allowOrganic:e.target.checked}))}/> <span className="ml-2">Available for organic</span></label><label className="block"><input type="checkbox" checked={form.allowPaid} onChange={e=>setForm(p=>({...p,allowPaid:e.target.checked}))}/> <span className="ml-2">Available for paid ads</span></label><label className="block"><input type="checkbox" checked={form.organicPreapproved} onChange={e=>setForm(p=>({...p,organicPreapproved:e.target.checked}))}/> <span className="ml-2">Organic pre-approved</span></label><label className="block"><input type="checkbox" checked={form.paidPreapproved} onChange={e=>setForm(p=>({...p,paidPreapproved:e.target.checked}))}/> <span className="ml-2">Paid pre-approved</span></label></div><div className="space-y-4"><div className="rounded-2xl border border-[var(--border)] p-4"><div className="mb-3 flex items-center gap-2 font-medium"><FiFilm/>Media</div><input key={`file-${resetKey}`} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" onChange={e=>setForm(p=>({...p,file:e.target.files?.[0]||null}))} className="w-full"/><p className="mt-2 text-xs text-[var(--muted-foreground)]">JPG, PNG, WebP, MP4, MOV or WebM.</p></div><div className="rounded-2xl border border-[var(--border)] p-4"><div className="mb-3 font-medium">Video thumbnail</div><input key={`thumb-${resetKey}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setForm(p=>({...p,thumbnail:e.target.files?.[0]||null,clearThumbnail:false}))}/></div></div></div><div className="mt-6 flex justify-end gap-3"><button onClick={close} className="rounded-2xl border border-[var(--border)] px-4 py-3">Cancel</button><button disabled={saving} onClick={()=>void save()} className="rounded-2xl bg-[var(--primary)] px-4 py-3 font-semibold text-[var(--primary-foreground)] disabled:opacity-60">{saving?"Saving…":form.id?"Save changes":"Upload asset"}</button></div></div></div>}
  </div>;
}
