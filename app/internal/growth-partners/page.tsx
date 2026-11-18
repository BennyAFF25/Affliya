import React from 'react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { canAccessMarketingDashboard } from '../../../utils/marketing/internalAccess';
import AdminClient from './AdminClient';
import { PageHeader } from '../../../components/ui';
import '../../growth-partners/growth-partners.css';
export const metadata:Metadata={title:'Internal Growth Partners',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function AdminPage(){
  const {data:{user}}=await createServerComponentClient({cookies}).auth.getUser();
  if(!canAccessMarketingDashboard(user?.email))notFound();
  return <div className="growth-partners"><main className="gp-shell"><PageHeader className="mb-6" title="Growth Partners · Internal" description="Review applications, partners and commissions." /><AdminClient /></main></div>;
}
