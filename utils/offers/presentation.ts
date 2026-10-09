// Preserve complete destination paths, query strings and fragments.
export function normalizeOfferDestination(value:string|null|undefined) {
 const raw=String(value || "").trim();
 if(!raw || /\s/.test(raw)) return null;
 const candidate=/^[a-z][a-z0-9+.-]*:/i.test(raw)?raw:"https://"+raw;
 try{const url=new URL(candidate);if(!["http:","https:"].includes(url.protocol) || !url.hostname || url.username || url.password)return null;return url.href;}catch{return null;}
}
export function getOfferPayoutTypeLabel(offer:{type?:string|null;payoutType?:string|null;payout_type?:string|null}) {
 const value=String(offer.payoutType || offer.payout_type || offer.type || "").trim();
 return value?value.replace(/[_-]+/g," ").replace(/\b\w/g,letter=>letter.toUpperCase()):null;
}
