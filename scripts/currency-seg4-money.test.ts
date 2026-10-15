import assert from 'node:assert/strict';
import * as m from '../utils/currency/money';
const aud = (value: string) => m.fromMajorString('AUD', value);
const usd = m.fromMajorString('USD', '20.00');
for (const operation of [m.add, m.subtract, m.compare, m.equals]) {
  assert.throws(() => operation(aud('15'), usd), m.CurrencyMismatchError);
  assert.throws(() => operation(aud('20'), usd), m.CurrencyMismatchError);
}
assert.equal(m.toMajorString(m.fromMajorString('JPY', '123')), '123');
assert.throws(() => m.fromMajorString('JPY', '1.0'));
assert.throws(() => aud('1.001'));
assert.equal(m.format(m.multiplyBps(aud('100.00'), 220, 'half-up')), 'A$2.20');
for (const [input, expected] of [['0.01', '0.01'], ['-0.01', '-0.01'], ['0.03', '0.02'], ['-0.03', '-0.02']]) {
  assert.equal(m.toMajorString(m.multiplyBps(aud(input), 5000, 'half-up')), expected);
}
assert.equal(m.toMajorString(m.multiplyBps(aud('0.01'), 4999, 'half-up')), '0.00');
assert.throws(() => m.multiplyBps(aud('1'), 2.2, 'half-up'));
assert.throws(() => m.multiplyBps(aud('1'), 220, 'floor' as 'half-up'));
for (const amount of ['10.00', '-10.00', '0.00', '0.01']) {
  for (const parts of [m.allocate(aud(amount), [0, 1, 2]), m.split(aud(amount), 3)]) {
    assert.equal(parts.reduce((sum, part) => m.add(sum, part), aud('0')).minor, aud(amount).minor);
  }
}
assert.deepEqual(m.split(aud('0.05'), 3).map(part => part.minor), [BigInt(2), BigInt(2), BigInt(1)]);
assert.equal(m.allocate(aud('0.01'), [0, 1, 1])[0].minor, BigInt(0));
for (const weights of [[], [0, 0], [-1, 2], [1.5]]) assert.throws(() => m.allocate(aud('1'), weights));
for (const count of [0, -1, 1.5, Infinity]) assert.throws(() => m.split(aud('1'), count));
const huge = aud('-123456789012345678901234567890.12');
assert.deepEqual(m.parse(JSON.stringify(m.toJSON(huge))), huge);
assert.deepEqual(m.parse(m.toJSON(usd)), usd);
assert.equal(m.format(aud('12.47')), 'A$12.47');
assert.equal(m.format(usd), 'USD 20.00');
assert.equal(m.format(m.fromMinor('JPY', BigInt(5))), 'JPY 5');
assert.equal(m.toMajorString(huge), '-123456789012345678901234567890.12');
assert.ok(Object.isFrozen(huge));
assert.ok(m.isZero(m.add(huge, m.negate(huge))));
assert.equal(m.toMajorString(m.subtract(aud('2'), aud('1.01'))), '0.99');
assert.equal(m.compare(aud('1'), aud('2')), -1);
assert.ok(m.equals(aud('1'), aud('1.00')));
for (const code of ['ZZZ', 'aud', '', 'toString', '__proto__']) {
  assert.throws(() => m.fromMinor(code, BigInt(0)));
  assert.throws(() => m.fromMajorString(code, '0'));
  assert.throws(() => m.parse({ currency: code, minor: '0' }));
}
assert.throws(() => m.fromMinor('AUD', 1.5 as unknown as bigint));
assert.throws(() => m.fromMinor('AUD', 100 as unknown as bigint));
assert.throws(() => m.fromMajorString('AUD', 12.34 as unknown as string));
for (const value of ['1e2', ' 1', '+1', '.5', '1.', 'NaN']) assert.throws(() => aud(value));
for (const value of [null, [], {}, {currency:'AUD',minor:1}, {currency:'AUD',minor:'1.5'}, {currency:'AUD',minor:'1e2'}]) assert.throws(() => m.parse(value));
console.log('Currency Segment 4 Money tests passed');
