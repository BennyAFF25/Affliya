import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { createServerSupabaseClient } from "../../../../../../utils/businessSubscriptions";
import { loadProposalDetails } from "../../../../../../utils/affiliate/proposalDetails";
export const dynamic = "force-dynamic";
export async function GET(_req:Request,context:{params:Promise<{kind:string;proposalId:string}>}) {
 try {
  const {kind,proposalId}=await context.params;
  if(!["paid","organic"].includes(kind) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proposalId)) return NextResponse.json({ok:false,error:"Invalid proposal."},{status:400});
  const client=createRouteHandlerClient({cookies});
  const {data:{user},error}=await client.auth.getUser();
  if(error || !user?.email) return NextResponse.json({ok:false,error:"Please sign in to view your proposal."},{status:401});
  const proposal=await loadProposalDetails(createServerSupabaseClient(),user.email,kind as "paid"|"organic",proposalId);
  if(!proposal) return NextResponse.json({ok:false,error:"Proposal not found."},{status:404});
  return NextResponse.json({ok:true,proposal});
 } catch(error) {
  console.error("[affiliate/proposal-details]",error);
  return NextResponse.json({ok:false,error:"Your proposal could not be loaded. Please try again."},{status:500});
 }
}
