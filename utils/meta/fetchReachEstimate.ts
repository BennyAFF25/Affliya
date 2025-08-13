// utils/meta/fetchReachEstimate.ts
export type ReachParams = {
  access_token: string;
  ad_account_id: string; // may include `act_`
  countries: string[];
  age_min: number;
  age_max: number;
  genders: number[]; // [] = all, [1]=male, [2]=female
  interests: { id?: string | number; name?: string }[];
  optimization_goal: 'REACH' | 'IMPRESSIONS' | 'LEAD_GENERATION' | string;
  currency: string;
};

export async function fetchReachEstimate(params: ReachParams) {
  const {
    access_token,
    ad_account_id,
    countries,
    age_min,
    age_max,
    genders,
    interests,
    optimization_goal,
    currency,
  } = params;

  // normalize once: numeric only on the wire; server will prefix act_
  const numericAd = String(ad_account_id).replace(/^act_/, '');

  const res = await fetch('/api/meta/estimate-reach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token,
      ad_account_id: numericAd,
      countries,
      age_min,
      age_max,
      genders,
      interests,
      optimization_goal,
      currency,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.warn('[estimate-reach route error]', json || res.statusText);
    throw new Error('Failed to fetch reach estimate');
  }
  return json;
}