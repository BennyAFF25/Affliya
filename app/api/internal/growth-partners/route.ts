import { adminAccess } from '../../../../utils/growthPartners/access';
import { approveApplication } from '../../../../utils/growthPartners/accounts';
import { allPartnerRows, commissionTotals, suspiciousFlags, type LedgerSummaryRow } from '../../../../utils/growthPartners/reporting';
import { changePartnerStatus, recordPartnerPayout, reviewCommission } from '../../../../utils/growthPartners/admin';
export const dynamic='force-dynamic';
export async function GET(req:Request) {
  const access=await adminAccess();
  if(access.status!==200) return Response.json({error:'Unauthorized'},{status:access.status});
  const {db}=access;
  try {
    const url=new URL(req.url), partnerId=url.searchParams.get('partner');
    if(partnerId) {
      const {data:partner,error}=await db.from('creator_partners').select('*').eq('id',partnerId).eq('program','growth_partner').single();
      if(error||!partner) return Response.json({error:'Partner not found'},{status:404});
      const [referrals,ledger,events]=await Promise.all([allPartnerRows(db,'business_creator_attributions',partnerId),allPartnerRows(db,'creator_commission_ledger',partnerId),allPartnerRows(db,'creator_referral_events',partnerId)]);
      const {data:payouts,error:payoutError}=await db.from('creator_partner_payouts').select('*').eq('creator_partner_id',partnerId).order('created_at',{ascending:false}).limit(100);
      if(payoutError)throw new Error();
      // Business names are internal-only; dashboard deliberately receives no email or business object.
      const businesses:Record<string,string>={};
      for(let offset=0;offset<referrals.length;offset+=100) {
        const {data,error:businessError}=await db.from('business_profiles').select('id,business_name').in('id',referrals.slice(offset,offset+100).map(row=>row.business_id));
        if(businessError)throw new Error();
        for(const row of data||[])businesses[row.id]=row.business_name||'Unnamed business';
      }
      return Response.json({partner,referrals:referrals.map(row=>({...row,business_name:businesses[String(row.business_id)]})),ledger,events,payouts,totals:commissionTotals(ledger as LedgerSummaryRow[]),flags:suspiciousFlags(partner.partner_email||'',referrals,events)});
    }
    const page=Math.max(0,Math.min(10000,Number(url.searchParams.get('page'))||0)), tab=url.searchParams.get('tab')||'applications';
    if(tab==='applications') {
      const {data,error,count}=await db.from('growth_partner_applications').select('*',{count:'exact'}).order('status',{ascending:false}).order('created_at',{ascending:false}).range(page*50,page*50+49);
      if(error)throw new Error();
      return Response.json({rows:data,count});
    }
    if(tab==='partners') {
      const {data,error,count}=await db.from('creator_partners').select('*',{count:'exact'}).eq('program','growth_partner').order('created_at',{ascending:false}).range(page*25,page*25+24);
      if(error)throw new Error();
      const rows=await Promise.all((data||[]).map(async partner=>{
        const [referrals,ledger,events]=await Promise.all([allPartnerRows(db,'business_creator_attributions',partner.id),allPartnerRows(db,'creator_commission_ledger',partner.id),allPartnerRows(db,'creator_referral_events',partner.id)]);
        return {...partner,registrations:referrals.length,trials:referrals.filter(r=>r.first_trial_started_at).length,paying:referrals.filter(r=>r.first_paid_at).length,clicks:events.filter(e=>e.event_type==='click').length,totals:commissionTotals(ledger as LedgerSummaryRow[]),flags:suspiciousFlags(partner.partner_email||'',referrals,events)};
      }));
      return Response.json({rows,count});
    }
    if(tab==='commissions') {
      const {data,error,count}=await db.from('creator_commission_ledger').select('*,creator_partners!inner(display_name,program)').eq('creator_partners.program','growth_partner').order('created_at',{ascending:false}).range(page*100,page*100+99);
      if(error)throw new Error();return Response.json({rows:data,count});
    }
    return Response.json({error:'Unknown tab'},{status:400});
  }catch{return Response.json({error:'Report unavailable'},{status:503});}
}
export async function POST(req:Request) {
  const access=await adminAccess();
  if(access.status!==200)return Response.json({error:'Unauthorized'},{status:access.status});
  if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin) return Response.json({error:'Invalid origin'},{status:403});
  const {db,email}=access;
  try {
    const body=await req.json(), action=String(body.action||''),id=String(body.id||'');
    const reason=typeof body.reason==='string'?body.reason.slice(0,2000):'';
    if(action==='approve_application')await approveApplication(db,id,email);
    else if(action==='reject_application') {
      const {error}=await db.from('growth_partner_applications').update({status:'rejected',rejection_reason:reason,reviewed_at:new Date().toISOString(),reviewed_by_email:email}).eq('id',id).eq('status','pending');
      if(error)throw new Error('Application review failed');
    }else if(action==='suspend'||action==='reactivate')await changePartnerStatus(db,id,action==='suspend',reason,email);
    else if(action==='approve_commission'||action==='reject_commission')await reviewCommission(db,id,action==='approve_commission',reason,email);
    else if(action==='record_payout')await recordPartnerPayout(db,id,Array.isArray(body.ledger_ids)?body.ledger_ids.map(String):[],String(body.reference||''),String(body.notes||''),email,String(body.method||'manual_bank_transfer').slice(0,100));
    else return Response.json({error:'Unknown action'},{status:400});
    return Response.json({ok:true});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Action failed'},{status:409});}
}
