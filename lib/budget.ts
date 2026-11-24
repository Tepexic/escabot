import { allowWithoutRedis, redis } from './redis.ts';

// Whole-site daily LLM budget, in tokens. IPs are cheap, so this is what bounds the bill:
// ~1M tokens ≈ $0.35/day at reported DeepSeek prices, ~70–100 real questions.
export const DAILY_TOKENS = 1_000_000;

const OFF_KEY = 'escabot:off';
const dayKey = () => `escabot:tokens:${new Date().toISOString().slice(0, 10)}`;

// Kill switch: set the `escabot:off` key in the Upstash console to stop all LLM calls.
export async function isOpen(): Promise<boolean> {
  if (!redis) return allowWithoutRedis;
  const [off, used] = await Promise.all([redis.get(OFF_KEY), redis.get<number>(dayKey())]);
  return !off && (used ?? 0) < DAILY_TOKENS;
}

export async function spend(tokens: number | undefined): Promise<void> {
  if (!redis || !tokens) return;
  const key = dayKey();
  await redis.incrby(key, tokens);
  await redis.expire(key, 60 * 60 * 48);
}
