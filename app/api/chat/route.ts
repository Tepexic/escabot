import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream, type UIMessage } from 'ai';
import { agentOptions } from '../../../lib/agent.ts';
import { allow } from '../../../lib/ratelimit.ts';

export const maxDuration = 60;

const MAX_HISTORY = 10;
const MAX_CHARS = 1000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const messages: UIMessage[] | undefined = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages es obligatorio' }, { status: 400 });
  }
  const recent = messages.slice(-MAX_HISTORY);
  // Public endpoint on a paid key: reject oversized user input instead of paying for it.
  const tooLong = recent.some(
    (m) => m.role === 'user' && m.parts.some((p) => p.type === 'text' && p.text.length > MAX_CHARS),
  );
  if (tooLong) return Response.json({ error: `Máximo ${MAX_CHARS} caracteres por mensaje` }, { status: 413 });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await allow(ip))) return Response.json({ error: 'Demasiadas preguntas, intenta en un rato' }, { status: 429 });

  const result = streamText(agentOptions(await convertToModelMessages(recent)));
  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
