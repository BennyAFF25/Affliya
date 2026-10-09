import type { SupabaseClient } from "@supabase/supabase-js";
export class SubmissionSessionError extends Error {
 constructor(message="Sign in again to submit. Your draft is still here."){super(message);this.name="SubmissionSessionError";}
}
export function isSubmissionSessionError(error:unknown){
 if(error instanceof SubmissionSessionError) return true;
 if(!error || typeof error!=="object") return false;
 const value=error as {status?:number;code?:string;message?:string};
 return value.status===401 || ["PGRST301","PGRST303","AUTH_REQUIRED"].includes(value.code || "") || /^(Unauthorized|UNAUTHENTICATED|auth_required)$|JWT.*expir|session.*missing|refresh.*token/i.test(value.message || "");
}
/** Same-account verification before writes. This helper never replays a mutation. */
export async function ensureSubmissionSession(client:Pick<SupabaseClient,"auth">,expectedUserId?:string,now=Date.now()){
 const initial=await client.auth.getSession();
 let session=initial.data.session;
 const error=initial.error;
 let refreshed=false;
 if(error || !session || !session.expires_at || session.expires_at*1000<=now+120000){
  const result=await client.auth.refreshSession();session=result.data.session;
  if(result.error || !session) throw new SubmissionSessionError();
  refreshed=true;
 }
 let verified=await client.auth.getUser();
 if((verified.error || !verified.data.user) && !refreshed){
  const result=await client.auth.refreshSession();
  if(result.error || !result.data.session) throw new SubmissionSessionError();
  session=result.data.session;verified=await client.auth.getUser();
 }
 if(verified.error || !verified.data.user?.email || !session) throw new SubmissionSessionError();
 if(expectedUserId && verified.data.user.id!==expectedUserId) throw new SubmissionSessionError("Sign in to the account that created this draft before submitting.");
 return {user:verified.data.user,session};
}
