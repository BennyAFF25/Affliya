type Row = Record<string, unknown>;
type Result<T> = { data: T | null; error: unknown };
type Query = PromiseLike<Result<Row[]>> & {
  select: (columns: string) => Query;
  eq: (column: string, value: unknown) => Query;
  maybeSingle: () => PromiseLike<Result<Row>>;
};
// Launch sends saved budget_amount (or legacy daily_budget) to Meta in cents.
// Lifetime pacing is not guaranteed: reserve the remaining lifetime allocation.
export function nextDayBudget(idea: Record<string, unknown> | null, spend = 0) {
  const raw = idea?.budget_amount ?? idea?.daily_budget ?? 1000;
  const amount = Math.max(100, parseInt(String(raw), 10) || 1000) / 100;
  return String(idea?.budget_type || 'DAILY').toUpperCase() === 'LIFETIME'
    ? Math.max(0, amount - spend) : amount;
}
export async function getFundingCoverage(client: { from: (table: string) => unknown }, ad: { id: string; affiliate_email?: string | null; ad_idea_id?: string | null }, spend: number) {
  const ads = await (client.from('live_ads') as Query).select('*').eq('affiliate_email', ad.affiliate_email);
  if (ads.error) throw new Error('PENDING_SPEND_UNAVAILABLE');
  const unpaid = (ads.data || []).reduce((sum: number, row: Row) => sum + Math.max(0,
    Number(row.id === ad.id ? spend : row.spend || 0) - Number(row.spend_transferred || 0)), 0);
  // The wallet is pooled: reserve all running campaigns' next-day budgets,
  // plus this campaign's budget when assessing a paused campaign for recovery.
  const campaigns = (ads.data || []).filter(row => row.id === ad.id ||
    ['active', 'live'].includes(String(row.status || '').toLowerCase()));
  if (!campaigns.some(row => row.id === ad.id)) throw new Error('CAMPAIGN_FUNDING_ROW_UNAVAILABLE');
  const budgets = await Promise.all(campaigns.map(async row => {
    let idea = null;
    const ideaId = row.id === ad.id ? ad.ad_idea_id : row.ad_idea_id;
    if (ideaId) {
      const result = await (client.from('ad_ideas') as Query).select('*').eq('id', ideaId).maybeSingle();
      if (result.error || !result.data) throw new Error('CAMPAIGN_BUDGET_UNAVAILABLE');
      idea = result.data;
    }
    return nextDayBudget(idea, Number(row.id === ad.id ? spend : row.spend || 0));
  }));
  return { unpaid: Math.round(unpaid * 100) / 100,
    nextDayBudget: Math.round(budgets.reduce((sum, budget) => sum + budget, 0) * 100) / 100 };

}
