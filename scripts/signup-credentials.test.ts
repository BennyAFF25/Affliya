import assert from 'node:assert/strict';
import { PASSWORD_ERROR, USERNAME_HINT, passwordRules, validPassword, validUsername } from '../utils/auth/credentials';
import { readFileSync } from 'node:fs';
for (const password of ['', 'abc1234', 'abcdefgh', '        ', null, 12345678]) assert.equal(validPassword(password), false);
for (const password of ['abcdefg1', '12345678', 'a longer password 2']) assert.equal(validPassword(password), true);
assert.deepEqual(passwordRules('abcdefg1'), { length: true, number: true });
assert.equal(USERNAME_HINT, '3–24 letters, numbers, . _ -');
for (const name of ['abc', 'sarahpromotes', 'A.Z_1-', 'a'.repeat(24)]) assert.equal(validUsername(name), true);
for (const name of ['ab', 'a'.repeat(25), 'test qa!', 'sarah@', 'ééé']) assert.equal(validUsername(name), false);
for (const route of ['signup', 'update-password']) {
 const source = readFileSync(`app/api/auth/${route}/route.ts`, 'utf8');
 assert.match(source, /validPassword\(body\?\.password\)/);
 assert.doesNotMatch(source, /service.role|admin\./i);
}
const signup = readFileSync('app/create-account/page.tsx','utf8');
assert.ok(signup.indexOf('!validPassword(password)') < signup.indexOf('!validUsername(trimmedUsername)'));
assert.match(signup, /autoComplete="new-password"/);
assert.match(signup, /autoComplete="email"/);
assert.match(signup, /<PasswordRules password=\{password\}/);
assert.match(signup, /href="\/legal\/privacy\/terms-of-service"/);
assert.ok(PASSWORD_ERROR.includes('8'));
const login = readFileSync('app/login/affiliate/page.tsx','utf8');
assert.doesNotMatch(login, /validPassword|passwordRules|minLength/);
assert.match(login, /current-password/);
console.log('Signup credential tests passed');
