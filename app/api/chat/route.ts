import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream, type UIMessage } from 'ai';
import { checkBotId } from 'botid/server';
import { agentOptions } from '../../../lib/agent.ts';
import { isOpen, spend } from '../../../lib/budget.ts';
import { isOffTopic, offTopicText, textResponse } from '../../../lib/gate.ts';
import { fromMoodTag } from '../../../lib/mood.ts';
import { allow } from '../../../lib/ratelimit.ts';

export const maxDuration = 60;

const MAX_HISTORY = 6;
const MAX_USER_CHARS = 1000;
const MAX_ASSISTANT_CHARS = 1500;

// The client sends the whole chat, so it is untrusted: keep only user/assistant text
// (no forged system messages or tool results) and trim old answers to keep tokens low.
function sanitize(messages: unknown[]): UIMessage[] {
  return messages
    .slice(-MAX_HISTORY)
    .flatMap((m) => {
      const msg = m as Partial<UIMessage>;
      if ((msg.role !== 'user' && msg.role !== 'assistant') || !Array.isArray(msg.parts)) return [];
      const text = msg.parts
        .map((p) => (p?.type === 'text' && typeof p.text === 'string' ? p.text : ''))
        .join('');
      const clean = msg.role === 'assistant' ? fromMoodTag(text).slice(0, MAX_ASSISTANT_CHARS) : text;
      return clean.trim() ? [{ id: String(msg.id ?? ''), role: msg.role, parts: [{ type: 'text' as const, text: clean }] }] : [];
    });
}

const userText = (m: UIMessage) => (m.parts[0]?.type === 'text' ? m.parts[0].text : '');

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.messages)) return Response.json({ error: 'messages es obligatorio' }, { status: 400 });
  const messages = sanitize(body.messages);
  if (messages.at(-1)?.role !== 'user') return Response.json({ error: 'El último mensaje debe ser del usuario' }, { status: 400 });
  if (messages.some((m) => m.role === 'user' && userText(m).length > MAX_USER_CHARS)) {
    return Response.json({ error: `Máximo ${MAX_USER_CHARS} caracteres por mensaje` }, { status: 413 });
  }

  // Cheapest checks first; every LLM call happens after all of them pass.
  if ((await checkBotId()).isBot) return Response.json({ error: 'Acceso denegado' }, { status: 403 });
  // x-real-ip is set by Vercel and can't be forged by the client.
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!(await allow(ip))) return Response.json({ error: 'Demasiadas preguntas, intenta en un rato' }, { status: 429 });
  if (!(await isOpen())) return Response.json({ error: 'Escabot está descansando, vuelve mañana' }, { status: 503 });

  const gate = await isOffTopic(messages.filter((m) => m.role === 'user').slice(-2).map(userText));
  await spend(gate.tokens);
  if (gate.off) return textResponse(offTopicText());

  const result = streamText({
    ...agentOptions(await convertToModelMessages(messages)),
    onFinish: ({ totalUsage }) => spend(totalUsage.totalTokens),
  });
  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
