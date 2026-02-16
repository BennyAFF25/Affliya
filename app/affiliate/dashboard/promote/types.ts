export type GenderOpt = '' | '1' | '2'; // 1=Male, 2=Female

export type PlacementKey =
  | 'facebook_feed'
  | 'instagram_feed'
  | 'instagram_reels'
  | 'facebook_reels'
  | 'facebook_stories'
  | 'instagram_stories';

export type AdFormState = {
  campaign_name: string;
  objective: string;
  budget_amount_dollars: number;
  budget_type: 'DAILY' | 'LIFETIME';
  start_time: string;
  end_time: string;
  location_countries: string;
  age_min: number;
  age_max: number;
  gender: GenderOpt;
  interests_csv: string;
  placements: Record<PlacementKey, boolean>;
  headline: string;
  caption: string;
  call_to_action: 'LEARN_MORE' | 'SHOP_NOW' | 'SIGN_UP' | string;
  display_link: string;
  bid_strategy: 'LOWEST_COST' | 'BID_CAP';
  bid_cap_dollars: number | '';
};
