/** Amounts must share the settlement currency; use the balance AFTER settlement. */
export function shouldPauseForFunding(available: number, unpaid: number, buffer: number) {
  return available <= 0 || available < Math.max(0, unpaid) + buffer;
}
