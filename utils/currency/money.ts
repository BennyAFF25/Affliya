import { CURRENCY_REGISTRY, type CurrencyCode } from './registry';

/** Exact representation only; registry membership does not enable money movement. */
export type Money = Readonly<{ currency: string; minor: bigint }>;
export type MoneyJSON = Readonly<{ currency: string; minor: string }>;
const ZERO = BigInt(0), ONE = BigInt(1), TEN = BigInt(10);

function exponent(currency: string): number {
  if (typeof currency !== 'string' || !Object.prototype.hasOwnProperty.call(CURRENCY_REGISTRY, currency)) {
    throw new RangeError(`Unknown currency: ${String(currency)}`);
  }
  return CURRENCY_REGISTRY[currency as CurrencyCode].minor_unit_exponent;
}
export function fromMinor(currency: string, minor: bigint): Money {
  exponent(currency);
  if (typeof minor !== 'bigint') throw new TypeError('Minor units must be bigint');
  return Object.freeze({ currency, minor });
}
export function fromMajorString(currency: string, major: string): Money {
  const digits = exponent(currency);
  if (typeof major !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(major)) throw new TypeError('Expected an exact decimal string');
  const negative = major.startsWith('-');
  const [whole, fraction = ''] = (negative ? major.slice(1) : major).split('.');
  if (fraction.length > digits) throw new RangeError('Too many decimal places');
  let scale = ONE;
  for (let i = 0; i < digits; i++) scale *= TEN;
  const minor = BigInt(whole) * scale + BigInt(fraction.padEnd(digits, '0') || '0');
  return fromMinor(currency, negative ? -minor : minor);
}
function validate(money: Money): void { fromMinor(money.currency, money.minor); }
export function toMajorString(money: Money): string {
  validate(money);
  const digits = exponent(money.currency);
  const absolute = (money.minor < ZERO ? -money.minor : money.minor).toString().padStart(digits + 1, '0');
  return (money.minor < ZERO ? '-' : '') + (digits ? absolute.slice(0, -digits) + '.' + absolute.slice(-digits) : absolute);
}
export class CurrencyMismatchError extends Error {
  constructor(a: string, b: string) {
    super(`Currency mismatch: ${a} and ${b}`);
    this.name = 'CurrencyMismatchError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
function matching(a: Money, b: Money): void {
  validate(a); validate(b);
  if (a.currency !== b.currency) throw new CurrencyMismatchError(a.currency, b.currency);
}
export function add(a: Money, b: Money): Money { matching(a, b); return fromMinor(a.currency, a.minor + b.minor); }
export function subtract(a: Money, b: Money): Money { matching(a, b); return fromMinor(a.currency, a.minor - b.minor); }
export function compare(a: Money, b: Money): -1 | 0 | 1 { matching(a, b); return a.minor < b.minor ? -1 : a.minor > b.minor ? 1 : 0; }
export function equals(a: Money, b: Money): boolean { return compare(a, b) === 0; }
export function isZero(money: Money): boolean { validate(money); return money.minor === ZERO; }
export function negate(money: Money): Money { validate(money); return fromMinor(money.currency, -money.minor); }
function integer(value: bigint | number): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new TypeError('Expected a safe integer or bigint');
  return BigInt(value);
}
/** Half-up rounds nearest minor unit; exact halves round away from zero, including negatives. */
export function multiplyBps(money: Money, bps: bigint | number, rounding: 'half-up'): Money {
  validate(money);
  if (rounding !== 'half-up') throw new RangeError('Unsupported rounding policy');
  const numerator = money.minor * integer(bps), denominator = BigInt(10000);
  const absolute = numerator < ZERO ? -numerator : numerator;
  const rounded = (absolute + denominator / BigInt(2)) / denominator;
  return fromMinor(money.currency, numerator < ZERO ? -rounded : rounded);
}
/** Nonnegative integer weights; remainder units go to positive weights in input order.
 * Negative amounts allocate their magnitude, then restore the sign. Totals are exact.
 */
export function allocate(money: Money, weights: readonly (bigint | number)[]): Money[] {
  validate(money);
  const ratios = weights.map(integer);
  const total = ratios.reduce((sum, weight) => {
    if (weight < ZERO) throw new RangeError('Negative allocation weight');
    return sum + weight;
  }, ZERO);
  if (total === ZERO) throw new RangeError('Allocation requires a positive total weight');
  const absolute = money.minor < ZERO ? -money.minor : money.minor;
  const parts = ratios.map(weight => absolute * weight / total);
  let remainder = absolute - parts.reduce((sum, part) => sum + part, ZERO);
  for (let i = 0; remainder > ZERO; i++) {
    if (ratios[i] > ZERO) { parts[i] += ONE; remainder -= ONE; }
  }
  return parts.map(part => fromMinor(money.currency, money.minor < ZERO ? -part : part));
}
export function split(money: Money, count: number): Money[] {
  if (!Number.isSafeInteger(count) || count <= 0) throw new RangeError('Split count must be a positive safe integer');
  return allocate(money, Array<bigint>(count).fill(ONE));
}
export function format(money: Money): string {
  return (money.currency === 'AUD' ? 'A$' : money.currency + ' ') + toMajorString(money);
}
/** Pass this result to JSON.stringify; raw bigint Money is deliberately not JSON serializable. */
export function toJSON(money: Money): MoneyJSON { validate(money); return { currency: money.currency, minor: money.minor.toString() }; }
/** Accept decoded JSON or JSON text. Never accepts numeric minor units or a fallback currency. */
export function parse(value: unknown): Money {
  const payload: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Invalid Money JSON');
  const { currency, minor } = payload as Record<string, unknown>;
  if (typeof currency !== 'string' || typeof minor !== 'string' || !/^-?\d+$/.test(minor)) throw new TypeError('Invalid Money JSON');
  return fromMinor(currency, BigInt(minor));
}
