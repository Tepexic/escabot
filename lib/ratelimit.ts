import { Ratelimit } from '@upstash/ratelimit';
import { allowWithoutRedis, redis } from './redis.ts';

const PER_IP_PER_HOUR = 20;

const perIp =
  redis && new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(PER_IP_PER_HOUR, '1 h'), prefix: 'escabot:ip' });

export async function allow(ip: string): Promise<boolean> {
  if (!perIp) return allowWithoutRedis;
  return (await perIp.limit(ip)).success;
}
