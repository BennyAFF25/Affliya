'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import Link from 'next/link';

import {
  Megaphone,
  Image as ImageIcon,
  Activity,
  Archive as ArchiveIcon,
} from 'lucide-react';

const inboxMeta = {
  ad_idea: {
    label: 'Ad Idea',
    icon: Megaphone,
  },
  live_ad: {
    label: 'Live Ad',
    icon: Activity,
  },
  organic_post: {
    label: 'Organic Post',
    icon: ImageIcon,
  },
};

interface AdIdea {
  id: string;
  offer_id: string;
  affiliate_email: string;
  status: string;
  created_at: string;
  archived?: boolean;
}

interface LiveAd {
  id: string;
  offer_id: string;
  affiliate_email: string;
  status: string;
  created_at: string;
  archived?: boolean;
}

interface OrganicPost {
  id: string;
  offer_id: string;
  affiliate_email: string;
  status: string;
  created_at: string;
  archived?: boolean;
}

interface InboxItem {
  id: string;
  type: 'ad_idea' | 'live_ad' | 'organic_post';
  offer_id: string;
  affiliate_email: string;
  status: string;
  created_at: string;
}

interface Offer {
  id: string;
  title: string;
}

const getArchiveKey = (email: string) => `nettmark_inbox_archived_${email}`;

const loadArchived = (email: string): InboxItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getArchiveKey(email));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveArchived = (email: string, items: InboxItem[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getArchiveKey(email), JSON.stringify(items));
};

export default function BusinessInbox() {
  const session = useSession();
  const user = session?.user;
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [archivedItems, setArchivedItems] = useState<InboxItem[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [offers, setOffers] = useState<Offer[]>([]);

  // Load archived items from localStorage on mount
  useEffect(() => {
    if (!user?.email) return;
    const stored = loadArchived(user.email);
    setArchivedItems(stored);
  }, [user?.email]);

  // Load offers for this business (for display names)
  useEffect(() => {
    const fetchOffers = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('[❌ Error fetching auth user for offers]', error.message);
        return;
      }

      const authUser = data?.user;
      if (!authUser?.email) return;

      const { data: offersData, error: offersErr } = await supabase
        .from('offers')
        .select('id, title')
        .eq('business_email', authUser.email);

      if (offersErr) {
        console.error('[❌ Error fetching offers for inbox]', offersErr.message);
        return;
      }

      setOffers(offersData || []);
    };

    fetchOffers();
  }, []);

  // Load pending inbox items for THIS business
  useEffect(() => {
    const fetchInboxData = async () => {
      const offerIds = offers.map(o => o.id);
      if (offerIds.length === 0) {
        setInboxItems([]);
        return;
      }

      const [ads, live, organic] = await Promise.all([
        supabase
          .from('ad_ideas')
          .select('*')
          .in('offer_id', offerIds),

        supabase
          .from('live_ads')
          .select('*')
          .in('offer_id', offerIds),

        supabase
          .from('organic_posts')
          .select('*')
          .in('offer_id', offerIds),
      ]);

      const combined: InboxItem[] = [
        ...(ads.data || []).map((a: any) => ({ ...a, type: 'ad_idea' })),
        ...(live.data || []).map((l: any) => ({ ...l, type: 'live_ad' })),
        ...(organic.data || []).map((o: any) => ({ ...o, type: 'organic_post' })),
      ];

      combined.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      const archivedIds = new Set(
        archivedItems.map((i) => `${i.type}-${i.id}`)
      );

      setInboxItems(
        combined.filter(
          (item) => !archivedIds.has(`${item.type}-${item.id}`)
        )
      );
    };

    fetchInboxData();
  }, [offers, archivedItems]);

  const getOfferName = (offerId: string) => {
    const offer = offers.find((o) => o.id === offerId);
    return offer?.title || 'Unknown Offer';
  };

  const archiveItem = async (item: InboxItem) => {
    if (!user?.email) return;

    const updatedArchived = [item, ...archivedItems];

    setArchivedItems(updatedArchived);
    saveArchived(user.email, updatedArchived);

    setInboxItems((prev) =>
      prev.filter((i) => !(i.id === item.id && i.type === item.type))
    );
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white px-12 pt-12 pb-24 w-full">
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-extrabold text-[#00C2CB] tracking-tight">Inbox</h1>
          <p className="text-gray-400 mt-2 text-lg">
            Affiliate requests and ad idea submissions for your offers.
          </p>
        </div>

        {/* Unified Inbox List */}
        {inboxItems.length > 0 ? (
          <section className="space-y-6">
            {inboxItems.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="bg-[#121212] rounded-xl p-6 border-l-4 border-[#00C2CB] hover:bg-[#141414] transition"
              >
                <div>
                  <div className="flex items-center gap-2 text-[#00C2CB] font-semibold">
                    {(() => {
                      const Icon = inboxMeta[item.type].icon;
                      return <Icon size={16} />;
                    })()}
                    <span>{inboxMeta[item.type].label}</span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1">
                    Offer: <span className="underline">{getOfferName(item.offer_id)}</span>
                  </p>
                  <p className="text-sm text-gray-400">
                    Affiliate: {item.affiliate_email}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="mt-4 flex justify-between">
                  {item.type === 'organic_post' && (
                    <Link href="/business/my-business/post-ideas">
                      <button className="px-4 py-1.5 bg-[#00C2CB] hover:bg-[#00b0b8] text-white rounded-md text-sm flex items-center gap-2">
                        Review Post
                      </button>
                    </Link>
                  )}

                  {item.type === 'live_ad' && (
                    <Link href="/business/manage-campaigns">
                      <button className="px-4 py-1.5 bg-[#00C2CB] hover:bg-[#00b0b8] text-white rounded-md text-sm flex items-center gap-2">
                        View Campaign
                      </button>
                    </Link>
                  )}

                  <button
                    onClick={() => archiveItem(item)}
                    className="px-3 py-1.5 border border-gray-600 hover:border-[#00C2CB] text-gray-300 hover:text-[#00C2CB] rounded-md text-sm flex items-center gap-2"
                  >
                    <ArchiveIcon size={14} />
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <div className="text-center mt-32 text-gray-500">
            <h3 className="text-2xl font-bold">Nothing new yet</h3>
            <p className="mt-2 text-md">
              All affiliate and ad submissions will appear here once received.
            </p>
          </div>
        )}

        {/* Archived toggle section */}
        {archivedItems.length > 0 && (
          <div className="mt-20 border-t border-[#1f1f1f] pt-10">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-[#00C2CB]"
            >
              <ArchiveIcon size={14} />
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>

            {showArchived && (
              <div className="mt-6 space-y-3">
                {archivedItems.map((item) => (
                  <div
                    key={`arch-${item.id}`}
                    className="flex items-center gap-3 bg-[#101010] border border-[#1f1f1f] rounded-lg px-4 py-3 text-sm text-gray-400"
                  >
                    {(() => {
                      const Icon = inboxMeta[item.type].icon;
                      return <Icon size={14} className="text-[#00C2CB]" />;
                    })()}
                    <span className="capitalize">{inboxMeta[item.type].label}</span>
                    <span className="text-gray-500">— {getOfferName(item.offer_id)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}