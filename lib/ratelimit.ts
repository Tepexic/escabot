import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Accept both Upstash's own names and the ones Vercel's Upstash integration injects.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const limiter =
  url && token
    ? new Ratelimit({ redis: new Redis({ url, token }), limiter: Ratelimit.slidingWindow(20, '1 h'), prefix: 'escabot' })
    : null;

// 20 messages per IP per hour. Without Redis: open in dev, closed in production,
// because the LLM key is paid and a public endpoint without a limit can drain it.
export async function allow(ip: string): Promise<boolean> {
  if (!limiter) return process.env.NODE_ENV !== 'production';
  return (await limiter.limit(ip)).success;
}
