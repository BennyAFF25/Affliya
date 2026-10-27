import assert from 'node:assert/strict';
import Module from 'node:module';
let user: { id: string } | null = { id: 'fixture' };
let signupCalls = 0, updateCalls = 0;
let authError: { message: string } | null = null;
let signupInput: any;
const auth = {
 getUser: async () => ({ data: { user }, error: null }),
 signUp: async (input: unknown) => { signupCalls++; signupInput=input; return { data: { session: null, user: { id:'fixture' } }, error: authError }; },
 updateUser: async () => { updateCalls++; return { error: authError }; },
};
const original = (Module as any)._load;
(Module as any)._load = function(name: string, ...args: any[]) {
 // Rate limiting is exercised separately by auth-rate-limit.test.ts.
 if (name.endsWith('/rateLimit')) return { authRateLimit: async () => true };
 if (name === '@supabase/supabase-js') return { createClient: () => ({ auth }) };
 if (name === '@supabase/auth-helpers-nextjs') return { createRouteHandlerClient: () => ({ auth }) };
 if (name === 'next/headers') return { cookies: () => ({}) };
 return original.call(this,name,...args);
};
const signup = require('../app/api/auth/signup/route');
const update = require('../app/api/auth/update-password/route');
const request = (body: unknown, origin = 'https://nettmark.com') => new Request('https://nettmark.com/api/auth/signup', {
 method:'POST', headers:{ origin,'Content-Type':'application/json' }, body:JSON.stringify(body),
});
async function main() {
 const input = { email:'fixture@example.com', password:'abcdefg1', options:{ data:{ role:'affiliate',username:'sarahpromotes' },emailRedirectTo:'https://evil.example/auth-redirect?returnTo=%2Fonboarding%2Ffor-partners%3FofferId%3Dfixture' } };
 for (const password of ['short1','abcdefgh']) {
  assert.equal((await signup.POST(request({ ...input,password }))).status,400);
  assert.equal((await update.POST(request({ password }))).status,400);
 }
 assert.equal(signupCalls,0); assert.equal(updateCalls,0);
 assert.equal((await signup.POST(request(input,'https://evil.example'))).status,403);
 assert.equal((await signup.POST(request({...input,options:{data:{role:'admin',username:'name'}}}))).status,400);
 assert.equal((await signup.POST(request(input))).status,200);
 assert.equal(signupCalls,1);
 const redirect = new URL(signupInput.options.emailRedirectTo);
 assert.equal(redirect.origin,'https://nettmark.com');
 assert.equal(redirect.searchParams.get('returnTo'),'/onboarding/for-partners?offerId=fixture');
 user = null;
 assert.equal((await update.POST(request({password:'abcdefg1'}))).status,401);
 assert.equal(updateCalls,0);
 user = { id:'fixture' };
 assert.equal((await update.POST(request({password:'abcdefg1'}))).status,200);
 assert.equal(updateCalls,1);
 authError={message:'Auth rejected request'};
 assert.equal((await signup.POST(request(input))).status,400);
 assert.equal((await update.POST(request({password:'abcdefg1'}))).status,400);
 console.log('Signup and password API validation/session tests passed');
}
main().finally(() => { (Module as any)._load=original; }).catch(error => { console.error(error); process.exitCode=1; });
