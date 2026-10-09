const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { chromium } = require("playwright");
const origin = "http://127.0.0.1:3100";
const userId = "33333333-3333-4333-8333-333333333333";
const offerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const user = { id: userId, email: "affiliate@example.test", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString() };
const expiresAt = Math.floor(Date.now() / 1000) + 86400;
const token = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." +
  Buffer.from(JSON.stringify({ sub: userId, email: user.email, aud: user.aud, role: user.role, exp: expiresAt, app_metadata: user.app_metadata, user_metadata: {} })).toString("base64url") + ".fixture-signature";
const session = { access_token: token, refresh_token: "fixture-refresh", token_type: "bearer", expires_in: 86400, expires_at: expiresAt, user };
const row = { id: offerId, title: "Test brand", description: "A sample brand offer", business_email: "brand@example.test", website: "https://brand.example.test", commission: 20, participation_mode: "open", status: "active", type: "one-time", currency: "USD", logo_url: null, meta_page_id: null, meta_ad_account_id: null, meta_pixel_id: null };
const dto = { description: row.description, logoUrl: null, commission: 20, commissionValue: null, currency: "USD", type: "one-time", participationMode: "open", requestStatus: "approved", readyOrganicCount: 0 };
const offers = [{ ...dto, id: offerId, title: "Test brand" }, { ...dto, id: otherId, title: "Another brand" }];
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://policy-fixture.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "promote-back-test-key" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "", browser, activePage, writes = [];
server.stdout.on("data", chunk => { serverLog += chunk; });
server.stderr.on("data", chunk => { serverLog += chunk; });
async function ready() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    try { if ((await fetch(origin + "/legal/privacy/cookies", { signal: AbortSignal.timeout(4000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error("Next.js test server did not become ready");
}
async function visibleInViewport(link, page) {
  const box = await link.boundingBox(), viewport = page.viewportSize();
  assert.ok(box && box.x >= 0 && box.y >= 64 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, "Back link is visible below the fixed app header");
}

async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([{name:"sb-policy-fixture-auth-token",value:encodeURIComponent(JSON.stringify(session)),url:origin}]);
 await context.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:"sb-policy-fixture-auth-token",value:JSON.stringify(session)});
 const page=await context.newPage();activePage=page;page.setDefaultTimeout(30000);
 const proposals=[
  {id:otherId,offer_id:offerId,affiliate_email:user.email,status:"pending",headline:"Saved headline",created_at:"2026-10-09T00:00:00Z",business_viewed_at:null},
  {id:"44444444-4444-4444-8444-444444444444",offer_id:offerId,affiliate_email:user.email,status:"pending",headline:"Opened proposal",created_at:"2026-10-08T00:00:00Z",business_viewed_at:"2026-10-09T01:00:00Z"}
 ];
 await page.route("**/*",async route=>{
  const request=route.request(),url=new URL(request.url()),json=(body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  if(url.hostname==="policy-fixture.supabase.co"){
   if(url.pathname==="/auth/v1/user")return json(user);
   if(url.pathname==="/auth/v1/token")return options.failRefresh?json({message:"Invalid refresh token",error_code:"refresh_token_not_found"},400):json(session);
   if(request.method()!=="GET"){writes.push(url.pathname);return json({message:"Unexpected write"},400);}
   const table=url.pathname.split("/").pop();
   if(table==="inbox_messages" && options.missingInbox)return json({code:"42P01",message:"missing inbox_messages"},404);
   const rows=table==="offers"?[row]:table==="profiles"?[{id:userId,role:"affiliate",email:user.email,terms_accepted:true,onboarding_completed:true}]:table==="affiliate_requests"?[{id:otherId,offer_id:offerId,status:"approved",affiliate_email:user.email}]:table==="ad_ideas"?proposals:[];
   if(table==="meta_connections")assert.ok(!url.searchParams.get("order")?.includes("updated_at"));
   const single=String(request.headers().accept || "").includes("vnd.pgrst.object");
   return json(single?rows[0] || null:rows);
  }
  if(url.origin!==origin)return route.abort();
  if(url.pathname.endsWith("/brand-content")){
   if(options.brand==="stall"){await new Promise(resolve=>setTimeout(resolve,12500));return json({ok:true,assets:[]}).catch(()=>{});}
   return options.brand==="error"?json({ok:false,error:"fixture library unavailable"},500):json({ok:true,assets:[]});
  }
  if(url.pathname==="/api/offers/content-readiness"){await new Promise(resolve=>setTimeout(resolve,6000));return json({ok:true,readiness:{}}).catch(()=>{});}
  if(url.pathname==="/api/affiliate/pending-paid-proposals")return json({success:false},500);
  if(url.pathname==="/api/affiliate/live-campaigns")return json({ok:true,campaigns:[]});
  if(url.pathname.startsWith("/api/affiliate/proposals/"))return json({ok:true,proposal:{
   id:otherId,kind:"paid",offerTitle:"Test brand",status:"pending",submittedAt:"2026-10-09T00:00:00Z",viewedAt:"2026-10-09T01:00:00Z",
   mediaUrl:null,thumbnailUrl:null,mediaType:null,headline:"Saved headline",caption:"Saved copy",cta:"SHOP_NOW",destinationUrl:row.website,trackingUrl:null,
   budget:25,budgetType:"DAILY",startAt:null,endAt:null,platform:null,
   targeting:{countries:"GB",ages:["18","65"],gender:null,interests:"Shopping",advantageAudience:true},placements:["facebook_feed"],placementsType:"manual"
  }});
  if(url.pathname.endsWith("/generate-promotion"))return json({available:false});
  if(request.method()!=="GET" && /\/(start|ready-organic-promotion|launch)|stripe/.test(url.pathname)){writes.push(url.pathname);return json({error:"Unexpected promotion action"},400);}
  if(url.pathname.startsWith("/api/"))return json({},url.pathname==="/api/chatbase/identify"?401:200);
  return route.continue();
 });
 return {context,page};
}
async function main(){
 await ready();browser=await chromium.launch({executablePath:"/usr/bin/google-chrome",headless:true,args:["--no-sandbox"]});
 {
  const {context,page}=await fixture({missingInbox:true});
  await page.goto(origin+"/affiliate/inbox");
  await page.getByText("Inbox unavailable",{exact:true}).waitFor();
  assert.ok(await page.getByRole("button",{name:"Try again",exact:true}).count());
  await context.close();
 }
 {
  const {context,page}=await fixture();
  await page.goto(origin+"/affiliate/dashboard/manage-campaigns");
  await page.getByRole("heading",{name:"Pending proposals",exact:true}).waitFor();
  await page.getByRole("link",{name:"View proposal",exact:true}).first().waitFor();
  assert.equal(await page.getByRole("link",{name:"View proposal",exact:true}).count(),2,"Funding failure cannot hide pending/viewed proposals");
  await page.goto(origin+"/affiliate/dashboard/reviews");
  const details=page.getByRole("link",{name:/View details/}).first();await details.waitFor();
  assert.match(await details.getAttribute("href"),/\/reviews\/paid\//);
  await details.click();
  await page.getByText("Submitted proposal · read only",{exact:true}).waitFor();
  await page.getByText("Saved headline",{exact:true}).waitFor();
  await page.getByText("25.00 · DAILY (currency not saved)",{exact:true}).waitFor();
  assert.equal(await page.locator("input,textarea").count(),0);
  await context.close();
 }
 {
  const {context,page}=await fixture();await page.goto(origin+"/affiliate/marketplace/"+offerId);
  const start=Date.now(),preview=page.getByRole("link",{name:"Preview site",exact:true});
  await preview.waitFor({timeout:3500});assert.ok(Date.now()-start<4000,"Offer renders before optional 6-second readiness");
  assert.equal(await preview.getAttribute("href"),"https://brand.example.test/");
  assert.equal(await page.getByText(row.description,{exact:true}).count(),1);
  await context.close();
 }
 for(const mode of ["ad","organic"]){
  const {context,page}=await fixture();await page.goto(origin+"/affiliate/dashboard/promote/"+offerId+"?mode="+mode);
  await page.getByText(/No brand content yet/).waitFor();
  await page.getByText("Loading brand content…",{exact:true}).waitFor({state:"hidden",timeout:2000});
  await context.close();
 }
 for(const brand of ["error","stall"]){
  const {context,page}=await fixture({brand});await page.goto(origin+"/affiliate/dashboard/promote/"+offerId+"?mode=organic");
  await page.getByText(/Brand content (could not|took too long)/).waitFor({timeout:20000});
  await page.getByText("Loading brand content…",{exact:true}).waitFor({state:"hidden",timeout:2000});
  await context.close();
 }
 {
  const {context,page}=await fixture({failRefresh:true});await page.goto(origin+"/affiliate/dashboard/promote/"+offerId+"?mode=organic");
  await page.getByText(/No brand content yet/).waitFor();
  const caption=page.getByPlaceholder("Write your caption here...");await caption.fill("Keep this unfinished promotion draft");
  const upload=page.locator('input[type="file"]').first();
  await upload.setInputFiles({name:"draft.png",mimeType:"image/png",buffer:Buffer.from("fixture-image")});
  await context.clearCookies();
  await page.evaluate(()=>{
   localStorage.removeItem("sb-policy-fixture-auth-token");
   const channel=new BroadcastChannel("sb-policy-fixture-auth-token");channel.postMessage({event:"SIGNED_OUT",session:null});setTimeout(()=>channel.close(),1000);
  });
  await page.getByText("Your session expired. Your draft and selected files are still here.",{exact:true}).waitFor();
  assert.ok(new URL(page.url()).pathname.includes("/promote/"));
  assert.equal(await caption.inputValue(),"Keep this unfinished promotion draft");
  assert.equal(await upload.evaluate(input=>input.files[0].name),"draft.png");
  await page.getByRole("button",{name:"Submit for Review",exact:true}).click();
  await page.getByRole("link",{name:"Sign in in a new tab",exact:true}).waitFor();
  assert.equal(await caption.inputValue(),"Keep this unfinished promotion draft");
  assert.equal(await upload.evaluate(input=>input.files[0].name),"draft.png");
  await context.close();
 }
 assert.deepEqual(writes,[],"Viewing and failed recovery never submit or charge");
 console.log("Affiliate browser QA: errors, counts, read-only details, offer loading/current URL, empty/error/timeout content and expired draft/file preservation passed");
 await browser.close();browser=null;
}
main().catch(async error=>{
 console.error(error);
 if(activePage && !activePage.isClosed()){console.error("Fixture URL:",activePage.url());try{console.error("Fixture text:",(await activePage.locator("main").allTextContents()).join("\n").slice(-5000));}catch{}}
 process.exitCode=1;
}).finally(async()=>{writeFileSync("affiliate-portal-qa-server.log",serverLog);if(browser)await browser.close();server.kill("SIGTERM");});
