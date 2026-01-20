'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from 'utils/supabase/pages-client';
import { useRouter } from 'next/navigation';

import {
  Megaphone,
  Image as ImageIcon,
  Activity,
  Archive as ArchiveIcon,
  ChevronRight,
  Clock,
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
  const router = useRouter();
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

  const getItemRoute = (item: InboxItem) => {
    if (item.type === 'ad_idea') return '/business/my-business/ad-ideas';
    if (item.type === 'organic_post') return '/business/my-business/post-ideas';
    if (item.type === 'live_ad') return '/business/manage-campaigns';
    return null;
  };

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
                role="button"
                tabIndex={0}
                onClick={() => {
                  const route = getItemRoute(item);
                  if (route) router.push(route);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    const route = getItemRoute(item);
                    if (route) router.push(route);
                  }
                }}
                className="bg-[#121212]/70 backdrop-blur rounded-2xl p-6 border border-[#1f1f1f] border-l-4 border-l-[#00C2CB]/70 hover:border-[#00C2CB]/40 hover:bg-[#141414]/70 transition-all cursor-pointer group shadow-[0_0_0_1px_rgba(255,255,255,0.02)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[#00C2CB] font-semibold">
                      {(() => {
                        const Icon = inboxMeta[item.type].icon;
                        return <Icon size={16} />;
                      })()}
                      <span>{inboxMeta[item.type].label}</span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-300">
                        Offer:{' '}
                        <span className="underline underline-offset-2 decoration-[#00C2CB]/40">
                          {getOfferName(item.offer_id)}
                        </span>
                      </p>
                      <p className="text-sm text-gray-400 truncate">
                        Affiliate: {item.affiliate_email}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock size={14} className="opacity-80" />
                        {new Date(item.created_at).toLocaleString()}
                      </span>

                      <span className="px-2 py-0.5 rounded-full border border-[#1f1f1f] text-gray-400 bg-[#0f0f0f] capitalize">
                        {item.status || 'pending'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-3">
                    <ChevronRight
                      size={18}
                      className="text-gray-600 group-hover:text-[#00C2CB] transition"
                    />

                    <div className="flex items-center gap-2">
                      {item.type === 'ad_idea' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push('/business/my-business/ad-ideas');
                          }}
                          className="px-4 py-2 bg-[#00C2CB] hover:bg-[#00b0b8] text-white rounded-lg text-sm font-medium"
                        >
                          Review Ad
                        </button>
                      )}

                      {item.type === 'organic_post' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push('/business/my-business/post-ideas');
                          }}
                          className="px-4 py-2 bg-[#00C2CB] hover:bg-[#00b0b8] text-white rounded-lg text-sm font-medium"
                        >
                          Review Post
                        </button>
                      )}

                      {item.type === 'live_ad' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push('/business/manage-campaigns');
                          }}
                          className="px-4 py-2 bg-[#00C2CB] hover:bg-[#00b0b8] text-white rounded-lg text-sm font-medium"
                        >
                          View Campaign
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveItem(item);
                        }}
                        className="px-3 py-2 border border-[#2a2a2a] hover:border-[#00C2CB]/60 text-gray-300 hover:text-[#00C2CB] rounded-lg text-sm flex items-center gap-2"
                      >
                        <ArchiveIcon size={14} />
                        Archive
                      </button>
                    </div>
                  </div>
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
                    className="flex items-center gap-3 bg-[#101010]/70 border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-gray-400 hover:border-[#00C2CB]/30 transition"
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