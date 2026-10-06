type PageResult<T> = { data: T[] | null; error: unknown };
type PagedQuery<T> = { range: (from: number, to: number) => PromiseLike<PageResult<T>> };

/** Respect the explicit report cap without silently stopping at the API's 1,000-row default. */
export async function readReportRows<T>(query: PagedQuery<T>): Promise<PageResult<T>> {
  const rows: T[] = [];
  for (let offset = 0; offset < 5000; offset += 1000) {
    const result = await query.range(offset, offset + 999);
    if (result.error) return { data: null, error: result.error };
    const page = result.data || [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return { data: rows, error: null };
}
