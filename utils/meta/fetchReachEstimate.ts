export async function fetchReachEstimate({
    access_token,
    ad_account_id,
    countries,
    age_min,
    age_max,
    genders,
    interests,
    optimization_goal,
    currency
  }: {
    access_token: string;
    ad_account_id: string;
    countries: string[];
    age_min: number;
    age_max: number;
    genders: number[];
    interests: { id: string; name: string }[];
    optimization_goal: string;
    currency: string;
  }) {
    try {
      const res = await fetch('/api/meta/estimate-reach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token,
          ad_account_id,
          countries,
          age_min,
          age_max,
          genders,
          interests,
          optimization_goal,
          currency
        })
      });
  
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
  
      return data.estimate;
    } catch (err) {
      console.error('[Reach Estimate Error]', err);
      return null;
    }
  }