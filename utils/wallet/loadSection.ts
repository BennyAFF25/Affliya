/** A deadline also handles clients/transports which never reject on abort. Late results are ignored. */
export async function loadWalletSection<T extends { error: unknown }>(
  task: PromiseLike<T>, apply: (result: T) => void,
  setState: (state: 'loading' | 'ready' | 'error') => void, milliseconds = 8000,
) {
  setState('loading');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([Promise.resolve(task), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Wallet request timed out')), milliseconds);
    })]);
    if (result.error) throw result.error;
    apply(result);
    setState('ready');
  } catch {
    setState('error');
  } finally { clearTimeout(timer); }
}
