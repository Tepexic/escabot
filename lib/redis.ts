import { Redis } from '@upstash/redis';

// Accept both Upstash's own names and the ones Vercel's Upstash integration injects.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export const redis = url && token ? new Redis({ url, token }) : null;

// Without Redis there are no limits, so: open in dev, closed in production
// (the LLM key is paid and a public endpoint without limits can drain it).
export const allowWithoutRedis = process.env.NODE_ENV !== 'production';
