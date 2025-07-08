'use client';

import { useEffect, useState } from 'react';
import { supabase } from 'utils/supabase/pages-client';
import { useRouter } from 'next/navigation';
import { useSession } from '@supabase/auth-helpers-react';
import Link from 'next/link';

const ManageCampaigns = () => {
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const [adIdeas, setAdIdeas] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchAdIdeas = async () => {
      const { data, error } = await supabase
        .from('ad_ideas')
        .select('*')
        .eq('affiliate_email', user.email)
        .eq('status', 'approved');

      if (!error && data) {
        setAdIdeas(data);
      } else {
        console.error('[❌ Failed to fetch ad ideas]', error);
      }
    };

    fetchAdIdeas();
  }, [user]);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[#00C2CB] mb-6">Manage Campaigns</h1>

      {adIdeas.length === 0 ? (
        <div className="bg-yellow-100 text-yellow-800 p-6 rounded-lg text-center">
          No live campaigns found.
        </div>
      ) : (
        <div className="space-y-4">
          {adIdeas.map((idea) => (
            <div key={idea.id} className="border border-[#00C2CB] p-4 rounded-xl bg-white shadow-sm flex justify-between items-center">
              <div>
                <p className="font-semibold text-[#00C2CB] text-lg">{idea.business_name || 'Campaign'}</p>
                <p className="text-sm text-gray-500">Status: Approved</p>
              </div>
              <Link href={`/affiliate/dashboard/manage-campaigns/${idea.id}`}>
                <button className="bg-[#00C2CB] hover:bg-[#00b0b8] text-white px-4 py-2 rounded-lg text-sm font-medium">
                  Edit Campaign
                </button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageCampaigns;