'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Escabot, type Mood } from './Escabot';

const STORAGE_KEY = 'escabot-chat';
const MAX_CHARS = 1000;
const EXAMPLES = [
  '¿Cuántas victorias tiene Checo?',
  '¿Quién ganó el GP de México 2015?',
  '¿Quién tiene más poles en la historia?',
  '¿Cuántas veces ganó Senna en Mónaco?',
];
const MOODS = ['neutral', 'happy', 'surprised', 'offtopic', 'error'];

const MOOD_TAG = /^\s*\[mood:(\w+)\]\s*/;
const moodOf = (text: string): Mood => {
  const m = text.match(MOOD_TAG)?.[1];
  return m && MOODS.includes(m) ? (m as Mood) : 'neutral';
};

const textOf = (m: UIMessage) =>
  m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
const queriesOf = (m: UIMessage) =>
  m.parts.flatMap((p) =>
    p.type === 'tool-run_sql' && p.input ? [(p.input as { query: string }).query] : [],
  );

// The answer's closing "🪜 Alex facts" paragraph gets the yellow comic box.
const startsWithLadder = (children: ReactNode) => {
  const first = Array.isArray(children) ? children[0] : children;
  return typeof first === 'string' && first.startsWith('🪜');
};
const markdown = {
  a: (props: React.ComponentProps<'a'>) => <a {...props} target="_blank" rel="noreferrer" />,
  table: (props: React.ComponentProps<'table'>) => (
    <div className="tbl">
      <table {...props} />
    </div>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className={startsWithLadder(children) ? 'facts' : undefined}>{children}</p>
  ),
};

function BotRow({ mood, children }: { mood: Mood; children: ReactNode }) {
  return (
    <div className="row">
      <Escabot mood={mood} className="mini" />
      <div className="bubble">{children}</div>
    </div>
  );
}

export default function Chat() {
  const { messages, sendMessage, status, error, setMessages, regenerate, stop } = useChat();
  const [input, setInput] = useState('');
  const loaded = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';

  // Chat lives only in this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {}
    loaded.current = true;
  }, [setMessages]);
  useEffect(() => {
    if (!loaded.current || busy || messages.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages, busy]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  const ask = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput('');
  };
  const reset = () => {
    stop();
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const last = messages.at(-1);
  const waiting = busy && last?.role === 'user';

  return (
    <div className="app">
      <header className="top">
        <h1>ESCABOT</h1>
        {messages.length > 0 && (
          <button type="button" className="ghost" onClick={reset}>
            Nueva conversación
          </button>
        )}
      </header>

      <main className="chat" aria-live="polite">
        {messages.length === 0 && (
          <section className="welcome">
            <Escabot mood="happy" className="hero" />
            <p className="hello">
              ¡Qué onda! Soy Escabot. Pregúntame lo que quieras de Fórmula 1, de 1950 a 2025, y te lo cuento con datos.
            </p>
            <div className="examples">
              {EXAMPLES.map((q) => (
                <button key={q} type="button" onClick={() => ask(q)}>
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div key={m.id} className="msg-user">
                {textOf(m)}
              </div>
            );
          }
          const text = textOf(m);
          const live = m === last && busy;
          const queries = queriesOf(m);
          return (
            <BotRow key={m.id} mood={live && !text ? 'thinking' : moodOf(text)}>
              {text ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdown}>
                  {text.replace(MOOD_TAG, '')}
                </ReactMarkdown>
              ) : (
                <p className="muted">Déjame subirme a revisar…</p>
              )}
              {queries.length > 0 && !live && (
                <details>
                  <summary>¿Cómo lo calculé?</summary>
                  {queries.map((q, i) => (
                    <code key={i}>{q}</code>
                  ))}
                </details>
              )}
            </BotRow>
          );
        })}

        {waiting && (
          <BotRow mood="thinking">
            <p className="muted">Déjame subirme a revisar…</p>
          </BotRow>
        )}

        {error && (
          <BotRow mood="error">
            <p>No se me abrió el DRS, intenta en un rato.</p>
            <button type="button" className="ghost" onClick={() => regenerate()}>
              Reintentar
            </button>
          </BotRow>
        )}
        <div ref={end} />
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <label htmlFor="q" className="sr-only">
          Tu pregunta
        </label>
        <input
          id="q"
          value={input}
          maxLength={MAX_CHARS}
          autoComplete="off"
          placeholder="Pregúntale a Escabot…"
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Enviar
        </button>
      </form>

      <footer>
        Datos: <a href="https://github.com/jolpica/jolpica-f1" target="_blank" rel="noreferrer">Jolpica-F1</a> (CC BY-NC-SA 4.0) · Homenaje de fans, no oficial ni afiliado a{' '}
        <a href="https://www.tiktok.com/@escaleraf1" target="_blank" rel="noreferrer">Alex Escalera</a>
      </footer>
    </div>
  );
}
