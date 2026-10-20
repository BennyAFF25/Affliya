import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { isMeaningfulDraft as meaningful, type PromotionDraft, promotionDraftKey, readPromotionDraft } from '../utils/affiliate/promotionDraft';

// Exercise the page's actual persistence effects and discard action against storage.
const source = readFileSync('app/affiliate/dashboard/promote/[offerId]/page.tsx', 'utf8');
const start = source.indexOf('  useEffect(() => {\n    if (!draftKey || defaultsReady');
const end = source.indexOf('  // Thumbnail validation', start);
assert.ok(start > 0 && end > start);
const code = ts.transpileModule(`${source.slice(start, end)}\nreturn discardDraft;`, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
const effects: (() => void)[] = [];
const storage = new Map<string, string>();
const initialForm = { campaign_name: 'Offer campaign', display_link: 'https://offer.test', objective: 'OUTCOME_TRAFFIC', headline: '', caption: '', budget_type: 'DAILY', start_time: '', location_countries: 'AU', age_min: 18, age_max: 65, gender: '', advantage_audience: false, call_to_action: 'LEARN_MORE', bid_strategy: 'LOWEST_COST', bid_cap_dollars: '', placements: { facebook_feed: true, instagram_feed: true, instagram_reels: false }, interests: [], end_time: '2027-01-01', budget_amount_dollars: 10 };
const isMeaningfulDraft = (draft: PromotionDraft) => meaningful(draft, initialForm as any);
const env: Record<string, any> = {
  useEffect: (fn: () => void) => effects.push(fn),
  localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, raw: string) => storage.set(key, raw), removeItem: (key: string) => storage.delete(key) },
  isMeaningfulDraft, readPromotionDraft, draftKey: promotionDraftKey('one@test.invalid', 'offer'), draftReady: null, defaultsReady: promotionDraftKey('one@test.invalid', 'offer'),
  initialForm: { current: initialForm }, draftCleared: { current: false }, discardedDraft: { current: false },
  form: initialForm, wizardStep: 1, adCreativeSource: 'upload', useLogoCreative: false,
  selectedAdBrandCreative: null, savedMedia: null, videoFile: null, imageFile: null, thumbnailFile: null,
};
for (const [setter, state] of Object.entries({ setForm: 'form', setWizardStep: 'wizardStep', setAdCreativeSource: 'adCreativeSource', setUseLogoCreative: 'useLogoCreative', setSelectedAdBrandCreative: 'selectedAdBrandCreative', setSavedMedia: 'savedMedia', setDraftNote: 'draftNote', setDraftReady: 'draftReady', setVideoFile: 'videoFile', setImageFile: 'imageFile', setThumbnailFile: 'thumbnailFile', setVideoPreviewUrl: 'videoPreviewUrl', setThumbPreviewUrl: 'thumbPreviewUrl', setThumbnailError: 'thumbnailError', setSubmitError: 'submitError' })) env[setter] = (value: unknown) => { env[state] = value; };
const discard = new Function('env', `with (env) { ${code} }`)(env) as () => void;
const [restore, save] = effects;
const form = { ...initialForm, campaign_name: 'Complete draft', budget_amount_dollars: 47, start_time: '2027-01-01T11:00', end_time: '2027-01-02T12:00', location_countries: 'AU,NZ', age_min: 21, age_max: 57, gender: '2', interests: [{ id: '123', name: 'Art' }], placements: { instagram_reels: true }, advantage_audience: true, headline: 'Headline', caption: 'Caption', call_to_action: 'SHOP_NOW', display_link: 'https://brand.test', bid_strategy: 'BID_CAP', bid_cap_dollars: 5 };
const draft = { version: 1, form, step: 4, source: 'upload', logo: false, brand: null, media: null, reselect: true };
const blank = { ...draft, baseline: initialForm, form: initialForm, reselect: false } as unknown as PromotionDraft;
assert.equal(isMeaningfulDraft(blank), false, 'offer-prefilled text, links, dates and step are not meaningful');
for (const field of Object.keys(initialForm)) {
  assert.equal(isMeaningfulDraft({ ...blank, form: { ...blank.form, [field]: 'Edited' } } as PromotionDraft), true, field);
}
assert.equal(meaningful(blank, { ...initialForm, end_time: '2030-02-02' } as any), false, 'later clock defaults do not change saved baseline');
assert.equal(isMeaningfulDraft({ ...blank, baseline: undefined, form: { ...blank.form, end_time: '2030-02-02' } }), false, 'legacy volatile dates are ignored');
for (const media of [{ logo: true }, { reselect: true }, { brand: { id: 'selected' } }, { media: { url: 'https://assets.test/image.jpg', type: 'image', thumbnail: null } }]) {
  assert.equal(isMeaningfulDraft({ ...blank, ...media } as PromotionDraft), true, 'media selections are meaningful');
}
env.defaultsReady = null; restore(); save();
assert.equal(storage.size, 0, 'persistence waits for async offer defaults');
env.defaultsReady = env.draftKey;
storage.set(env.draftKey, JSON.stringify(blank)); restore();
assert.equal(storage.has(env.draftKey), false, 'empty stored drafts are removed on load');
assert.equal(env.draftNote as unknown, null, 'empty stored drafts are removed silently');
assert.equal(env.wizardStep, 1);
save();
assert.equal(storage.has(env.draftKey), false, 'initial autosave does not create a draft');
env.form = { ...initialForm, caption: "One edit" }; save();
restore(); assert.equal(env.form.caption, "One edit", "one edited field restores");
env.form = form; save();
env.form = initialForm; save();
assert.equal(storage.has(env.draftKey), false, 'clearing all user content removes an existing draft');
storage.set(env.draftKey, JSON.stringify(draft));
restore();
assert.deepEqual(env.form, form); assert.equal(env.wizardStep, 4);
assert.match(env.draftNote, /Draft restored.*Re-select/);
assert.equal(env.videoFile, null);
save();
assert.deepEqual(JSON.parse(storage.get(env.draftKey)!).form, form, 'every step field survives restore and autosave');
env.form = initialForm;
env.savedMedia = { url: 'https://assets.test/video.mp4', type: 'video', thumbnail: 'https://assets.test/thumb.jpg' };
save(); env.form = initialForm; env.savedMedia = null; restore();
assert.equal(env.savedMedia.url, 'https://assets.test/video.mp4');
assert.equal(env.savedMedia.thumbnail, 'https://assets.test/thumb.jpg');
assert.doesNotMatch(env.draftNote, /Re-select/);
discard(); save();
assert.equal(storage.has(env.draftKey), false, 'discard removes the key and does not recreate a blank draft');
assert.deepEqual(env.form, initialForm); assert.equal(env.savedMedia, null); assert.equal(env.wizardStep, 1);
env.form = { ...initialForm, campaign_name: 'New draft' }; save();
assert.equal(JSON.parse(storage.get(env.draftKey)!).form.campaign_name, 'New draft');
env.draftCleared.current = true; storage.delete(env.draftKey); save();
assert.equal(storage.has(env.draftKey), false, 'successful submit suppression prevents autosave from resurrecting a cleared draft');
env.draftKey = promotionDraftKey('two@test.invalid', 'offer'); env.defaultsReady = env.draftKey; restore();
assert.deepEqual(env.form, initialForm, 'new account cannot inherit the previous account draft');
assert.equal(env.savedMedia, null);
storage.set(env.draftKey, '{bad'); restore();
assert.ok(env.draftNote, 'corrupt draft produces visible feedback');
env.localStorage.setItem = () => { throw new Error('Quota'); }; env.form = { ...form }; save();
assert.match(env.draftNote, /could not be saved/);
console.log('Paid draft actual-page effects: all fields, reselect note, uploaded media, discard, success clearing, account isolation and storage failures pass.');
