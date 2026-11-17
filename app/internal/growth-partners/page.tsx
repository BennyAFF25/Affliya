import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { canAccessMarketingDashboard } from '../../../utils/marketing/internalAccess';
import AdminClient from './AdminClient';
import '../../growth-partners/growth-partners.css';
export const metadata:Metadata={title:'Internal Growth Partners',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function AdminPage(){
  const {data:{user}}=await createServerComponentClient({cookies}).auth.getUser();
  if(!canAccessMarketingDashboard(user?.email))notFound();
  return <div className="growth-partners"><main className="gp-shell"><h1 className="mb-6 text-3xl font-semibold">Growth Partners · Internal</h1><AdminClient /></main></div>;
}
