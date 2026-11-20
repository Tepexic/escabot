import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const PER_IP_PER_HOUR = 20;
// Whole-site cap: IPs are cheap, so this is what bounds the worst-case LLM bill
// (~$0.005/question on DeepSeek → ~$1/day at 200).
const SITE_PER_DAY = 200;

// Accept both Upstash's own names and the ones Vercel's Upstash integration injects.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

const perIp = redis &&
  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(PER_IP_PER_HOUR, '1 h'), prefix: 'escabot:ip' });
const site = redis &&
  new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(SITE_PER_DAY, '1 d'), prefix: 'escabot:site' });

// Without Redis: open in dev, closed in production, because the LLM key is paid
// and a public endpoint without a limit can drain it.
export async function allow(ip: string): Promise<boolean> {
  if (!perIp || !site) return process.env.NODE_ENV !== 'production';
  // Per-IP first, so one noisy user doesn't eat the site's daily budget.
  if (!(await perIp.limit(ip)).success) return false;
  return (await site.limit('all')).success;
}
