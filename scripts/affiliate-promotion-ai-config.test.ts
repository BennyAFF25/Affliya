import * as assert from "node:assert/strict";
import { getPromotionAIConfig } from "../lib/affiliate/promotionAI";

const enabled = { NODE_ENV: "test" as const, NETTMARK_AFFILIATE_AI_ENABLED: "true", OPENAI_API_KEY: "test-key" };
const kv = { ...enabled, KV_REST_API_URL: "https://nettmark-kv.upstash.io", KV_REST_API_TOKEN: "kv-token" };
const legacy = { ...enabled, UPSTASH_REDIS_REST_URL: "https://nettmark-upstash.upstash.io", UPSTASH_REDIS_REST_TOKEN: "upstash-token" };

assert.equal(getPromotionAIConfig(kv)?.redisUrl, "https://nettmark-kv.upstash.io");
assert.equal(getPromotionAIConfig(kv)?.redisToken, "kv-token");
assert.equal(getPromotionAIConfig(legacy)?.redisUrl, "https://nettmark-upstash.upstash.io");
assert.equal(getPromotionAIConfig(legacy)?.redisToken, "upstash-token");
assert.equal(getPromotionAIConfig({ ...kv, ...legacy })?.redisToken, "upstash-token", "explicit UPSTASH credentials take precedence");
assert.equal(getPromotionAIConfig({ ...kv, UPSTASH_REDIS_REST_URL: legacy.UPSTASH_REDIS_REST_URL }), null, "never mix credentials from separate pairs");
assert.equal(getPromotionAIConfig({ ...kv, NETTMARK_AFFILIATE_AI_ENABLED: "false" }), null, "AI must remain disabled without flag");
assert.equal(getPromotionAIConfig({ ...kv, OPENAI_API_KEY: "" }), null);
assert.equal(getPromotionAIConfig({ ...kv, KV_REST_API_URL: "http://insecure.example" }), null);
assert.equal(getPromotionAIConfig({ ...kv, KV_REST_API_URL: "https://host.example/path?token=bad" }), null);

console.log("affiliate promotion AI environment config tests passed");
